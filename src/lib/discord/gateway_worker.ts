import * as store from "svelte/store";
import * as api from "#/lib/discord/api.js";
import type * as gateway from "#/lib/discord/gateway.js";
import { GatewayURL } from "#/lib/discord/gateway.js";
import { sleep } from "#/lib/promise.js";

import type { Command, Event } from "./gateway_worker_decls.js";

let session: Session | undefined;

onmessage = async (ev: MessageEvent<Command["command"]>) => {
  if (!ev.data.t) {
    console.error("gateway_worker: ignoring invalid command", ev.data);
    return;
  }

  const c = ev.data;
  switch (c.t) {
    case "connect": {
      if (session) {
        console.log("gateway_worker: already connected");
        return;
      }

      try {
        session = new Session(c.d.idprop);
        const result = await session.open(c.d.session);
        send({
          res: "ok",
          id: c.id,
          v: result,
        });
      } catch (err) {
        send({
          res: "error",
          id: c.id,
          v: err,
        });
      }

      break;
    }
    case "send": {
      if (!session) {
        send({
          res: "error",
          id: c.id,
          v: new Error("not connected"),
        });
        return;
      }

      try {
        await session.send(c.d);
        send({
          res: "ok",
          id: c.id,
          v: undefined,
        });
      } catch (err) {
        send({
          res: "error",
          id: c.id,
          v: err,
        });
      }

      break;
    }
    default: {
      console.log("gateway_worker: ignoring unknown command", c);
      return;
    }
  }
};

function send(event: Event | Command["reply"]) {
  postMessage(event);
}

class Session {
  private heartbeat = -1;
  private client = api.Client.default();
  private event = store.writable<gateway.Event>({ op: null });
  private ws: WebSocket | null = null;

  constructor(private idprop: gateway.IdentifyProperties) {
    this.event.subscribe((event) => {
      send({ t: "event", d: event });
    });
  }

  async send(command: gateway.Command) {
    if (!this.ws) {
      throw new Error("websocket not opened");
    }

    if (this.ws.readyState != WebSocket.OPEN) {
      throw new Error(`websocket not ready, state ${this.ws.readyState}`);
    }

    console.debug("gateway_worker: sending", command);
    this.ws.send(JSON.stringify(command));
  }

  // open opens the Discord gateway. False is returned if a token is needed.
  // True is returned if the session has been successfully opened. At this
  // point, .token will return a valid token.
  async open(session: gateway.SessionData): Promise<boolean> {
    type openState =
      | { readonly state: "ready"; d: gateway.SessionData }
      | { readonly state: "failed"; d: any }
      | { readonly state: "retry" };

    // Have an overall timeout of 30s.
    const timeout = new Promise<void>(async (ok, error) => {
      await sleep(60000);
      error(new Error("timeout connecting to gateway"));
    });

    for (let attempt = 0; true; attempt++) {
      this.status("trying to open session...");

      try {
        await this.init();
        this.status("websocket connected, hello received");

        const done = this.waitForEvent<openState>((ev) => {
          switch (ev.op) {
            case 0: {
              switch (ev.t) {
                case "READY": {
                  return {
                    state: "ready",
                    d: {
                      token: session.token,
                      session_id: ev.d.session_id,
                      seq: ev.s,
                    },
                  };
                }
                case "RESUMED": {
                  return {
                    state: "ready",
                    d: session!,
                  };
                }
              }
              break;
            }
            case 9: {
              // invalid session
              if (ev.d) {
                return { state: "retry" };
              }
              return {
                state: "failed",
                d: new Error("invalid session"),
              };
            }
            case -1: {
              // unexpected close, retry
              throw errorEvent(ev);
            }
          }
          return false;
        });

        if (session.session_id) {
          console.debug("gateway_debug: we have old session ID, sending resume command");
          await this.send({
            op: 6,
            d: session,
          });
        } else {
          console.debug("gateway: no old data, sending new identify command");
          await this.send({
            op: 2,
            d: {
              token: session.token,
              properties: this.idprop,
              // https://github.com/diamondburned/ningen/blob/d39554fd5d6743a5e3604753150cc7cb8d8c4660/ningen.go#L101
              capabilities: 253,
            },
          });
        }

        this.status("waiting for session to open...");
        const raceRes = await Promise.race([timeout, done]);

        const res = raceRes as openState;
        switch (res.state) {
          case "ready": {
            console.debug("gateway_worker: session opened successfully");
            return true;
          }
          case "failed": {
            // The session ID might be invalid, but maybe the token is still
            // valid.
            if (session.session_id) {
              console.debug("gateway_worker: session ID is invalid, retrying");
              session.session_id = undefined;
              break;
            }
            return false;
          }
          case "retry": {
            break;
          }
        }
      } catch (err) {
        console.debug("gateway_worker: cannot connect:", err);
      }

      this.status("cannot connect to websocket, retrying...");
      const delay = (4 + 2 * attempt) * 1000;
      await Promise.race([sleep(delay), timeout]);
    }
  }

  private status(v: string) {
    console.debug(`gateway_worker: status: ${v}`);
    send({ t: "status", d: v });
  }

  private init(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.ws = this.client.client.websocket(GatewayURL);

    this.ws.addEventListener("message", (msg) => {
      const ev = JSON.parse(msg.data) as gateway.Event;
      if (ev.op === undefined) {
        console.debug("websocket received unknown event", ev);
        return;
      }

      switch (ev.op) {
        case 10: {
          if (this.heartbeat != -1) {
            clearInterval(this.heartbeat);
            this.heartbeat = 0;
          }
          this.heartbeat = window.setInterval(
            () =>
              this.send({ op: 1, d: null }).catch(() => {
                clearInterval(this.heartbeat);
                this.heartbeat = 0;
              }),
            ev.d.heartbeat_interval
          );
          break;
        }
      }

      this.event.set(ev);
      console.debug("websocket received event", ev);
    });

    this.ws.addEventListener("error", (ev) => {
      console.error("websocket error:", ev);
      this.event.set({ op: -1, d: { error: ev } });
    });

    this.ws.addEventListener("close", (ev) => {
      console.debug("websocket closed:", ev);
      this.ws = null;
      this.event.set({ op: -1, d: { close: ev } });
    });

    return this.waitForEvent((ev: gateway.Event) => {
      switch (ev.op) {
        case 10:
          return;
        case -1:
          throw errorEvent(ev);
        default:
          return false;
      }
    });
  }

  private waitForEvent<T>(f: (ev: gateway.Event) => T | false): Promise<T> {
    return new Promise((resolve, reject) => {
      let done: T | false | { __rejected: true } = false;

      let unsub: store.Unsubscriber | undefined;
      unsub = this.event.subscribe((ev) => {
        if (done === false) {
          try {
            done = f(ev);
            if (done !== false) {
              resolve(done);
            }
          } catch (err) {
            // need any sentinel that is uncommon
            done = { __rejected: true };
            reject(err);
          }
        }

        if (done !== false && unsub) {
          unsub();
        }
      });
    });
  }
}

function errorEvent(ev: Extract<gateway.Event, { readonly op: -1 }>): any {
  if (ev.d.error) {
    return ev.d.error;
  } else if (ev.d.close) {
    return new Error(`websocket closed: code ${ev.d.close.code}`);
  } else {
    return new Error("websocket closed");
  }
}
