import * as store from "svelte/store";
import * as api from "#/lib/discord/api.js";
import * as discord from "#/lib/discord/discord.js";
import * as persistent from "#/lib/persistent.js";
import { sleep } from "#/lib/promise.js";

type SessionData = {
  token: string;
  session_id?: string;
  seq?: number;
};

// GatewayURL is the URL of the Discord gateway.
const GatewayURL = "wss://gateway.discord.gg/?v=9&encoding=json";

export type IdentifyProperties = {
  os: string;
  browser: string;
  device: string;
  browser_user_agent?: string;
  browser_version?: string;
  os_version?: string;
};

export function defaultIdentifyProperties(): IdentifyProperties {
  return {
    os: navigator.platform.split(" ")[0],
    browser: navigator.userAgent.split(" ")[0],
    device: "Kaicord",
    browser_user_agent: navigator.userAgent,
  };
}

export type Event =
  // initial event
  | { readonly op: null }
  // internal error/closure event
  | { readonly op: -1; d: { error?: any; close?: CloseEvent } }
  // dispatch event
  | DispatchEvent
  // invalid session event, boolean indicates whether to reconnect
  | { readonly op: 9; d: boolean }
  // hello event
  | { readonly op: 10; d: { heartbeat_interval: number } }
  // heartbeat ack
  | { readonly op: 11 };

function errorEvent(ev: Extract<Event, { readonly op: -1 }>): any {
  if (ev.d.error) {
    return ev.d.error;
  } else if (ev.d.close) {
    return new Error(`websocket closed: code ${ev.d.close.code}`);
  } else {
    return new Error("websocket closed");
  }
}

export type ReadyData = {
  v: number;
  user: api.User;
  session_id: string;
  private_channels: api.Channel[];
  guilds: GuildCreateData[];
  users: api.User[];
  read_state: {
    id: string;
    last_message_id: string;
    mention_count: number;
  }[];
  // user_guild_settings
  // relationships
  // presences
};

export type GuildCreateData = api.Guild & {
  members?: api.Member[];
  channels?: api.Channel[];
  threads?: api.Channel[];
};

export type DispatchEvent = {
  readonly op: 0;
  s: number;
} & (
  | { readonly t: "READY"; d: ReadyData }
  | { readonly t: "RESUMED" }
  | { readonly t: "GUILD_CREATE"; d: GuildCreateData }
  | { readonly t: "GUILD_UPDATE"; d: { id: string } & Partial<api.Guild> }
  | { readonly t: "GUILD_DELETE"; d: { id: string; unavailable: boolean } }
  | { readonly t: "CHANNEL_CREATE"; d: api.Channel }
  | { readonly t: "CHANNEL_UPDATE"; d: { id: string } & Partial<api.Channel> }
  | { readonly t: "CHANNEL_DELETE"; d: { id: string } & Partial<api.Channel> }
  | { readonly t: "MESSAGE_CREATE"; d: api.Message & { member?: Omit<api.Member, "user"> } }
  | { readonly t: "MESSAGE_UPDATE"; d: api.Message & { member?: Omit<api.Member, "user"> } }
  | { readonly t: "MESSAGE_DELETE"; d: { id: string; channel_id: string } }
  | { readonly t: "THREAD_CREATE"; d: api.Channel }
  | { readonly t: "THREAD_UPDATE"; d: { id: string } & Partial<api.Channel> }
  | { readonly t: "THREAD_DELETE"; d: { id: string; guild_id?: string; parent_id?: string } }
  | {
      readonly t: "THREAD_LIST_SYNC";
      d: {
        guild_id: string;
        channel_ids: string[];
        threads: api.Channel[];
      };
    }
  | {
      readonly t: "GUILD_MEMBERS_CHUNK";
      d: {
        guild_id: string;
        members: api.Member[];
        // presences
      };
    }
  | {
      readonly t: "TYPING_START";
      d: {
        channel_id: string;
        guild_id?: string;
        user_id: string;
        member?: api.Member; // unsure if partial, be careful!
        timestamp: number; // unix
      };
    }
);

export type Command =
  | { readonly op: 1; d: number | null }
  | {
      readonly op: 2;
      d: {
        token: string;
        properties: IdentifyProperties;
        client_state?: Record<string, unknown>;
        capabilities?: number;
      };
    }
  | {
      readonly op: 6;
      d: SessionData;
    }
  | {
      readonly op: 8;
      d: {
        guild_id: string | string[];
        user_ids?: string[];
        query?: string;
        limit?: number;
        presences: boolean;
      };
    }
  | {
      readonly op: 14;
      d: {
        typing: boolean;
        threads: boolean;
        activities: boolean;
        guild_id: string;
      };
    };

export class Session {
  public readonly event: store.Readable<Event>;
  public readonly token: store.Writable<string | null>;
  public readonly status = store.writable("");

  private _event = store.writable<Event>({ op: null });
  private heartbeat: number = -1;
  // TODO: move the websocket to a dedicated web worker. That'll allow us to
  // manage the session asynchronously.
  private ws: WebSocket | null = null;
  private sessionData: SessionData | null = null;

  constructor(
    public readonly client: api.Client,
    public readonly key = "gw_state",
    public readonly idprop = defaultIdentifyProperties()
  ) {
    this.event = store.readonly(this._event);
    this.token = persistent.writable(`${key}_token`, null);
  }

  async send(command: Command) {
    if (!this.ws) {
      throw new Error("websocket not opened");
    }

    if (this.ws.readyState != WebSocket.OPEN) {
      throw new Error(`websocket not ready, state ${this.ws.readyState}`);
    }

    console.debug("gateway: sending", command);
    this.ws.send(JSON.stringify(command));
  }

  // open opens the Discord gateway. False is returned if a token is needed.
  // True is returned if the session has been successfully opened. At this
  // point, .token will return a valid token.
  async open(token?: string): Promise<boolean> {
    enum openState {
      success,
      failure,
      retry,
    }

    // Have an overall timeout of 30s.
    const timeout = new Promise<void>(async (ok, error) => {
      await sleep(60000);
      error(new Error("timeout connecting to gateway"));
    });

    while (true) {
      this.changeStatus("connecting to gateway...");

      try {
        await Promise.race([this.init(), timeout]);
        this.changeStatus("websocket connected, hello received");

        const done = this.waitForEvent((ev) => {
          switch (ev.op) {
            case 0: {
              switch (ev.t) {
                case "READY":
                  this.sessionData = {
                    token: token!,
                    session_id: ev.d.session_id,
                    seq: ev.s,
                  };
                  return openState.success;
                case "RESUMED":
                  return openState.success;
              }
              break;
            }
            case 9: {
              // invalid session
              return ev.d ? openState.retry : openState.failure;
            }
            case -1: {
              // unexpected close, retry
              throw errorEvent(ev);
            }
          }

          return false;
        });

        if (this.sessionData) {
          console.debug("gateway: we have old data, sending resume command");
          await this.send({
            op: 6,
            d: this.sessionData,
          });
        } else {
          if (!token) {
            let savedToken = store.get(this.token);
            if (savedToken) {
              token = savedToken;
            } else {
              console.debug("gateway: no token saved, returning false");
              return false;
            }
          }

          console.debug("gateway: no old data, sending new identify command");
          await this.send({
            op: 2,
            d: {
              token,
              properties: this.idprop,
              // https://github.com/diamondburned/ningen/blob/d39554fd5d6743a5e3604753150cc7cb8d8c4660/ningen.go#L101
              capabilities: 253,
            },
          });
        }

        this.changeStatus("waiting for ready/resumed event");
        const result = await Promise.race([done, timeout]);

        switch (result) {
          case openState.success: {
            console.debug("gateway: session opened successfully");
            this.token.set(token!);
            this.client.token = token!; // take over the client
            return true;
          }
          case openState.failure: {
            // The session ID might be invalid, but maybe the token is still
            // valid.
            if (this.sessionData) {
              this.sessionData = null;
              break;
            }
            return false;
          }
          case openState.retry: {
            break;
          }
        }
      } catch (err) {
        console.debug("gateway: cannot connect:", err);
      }

      this.changeStatus("cannot connect to websocket, retrying...");
      await sleep(5000);
    }
  }

  private init(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.ws = this.client.client.websocket(GatewayURL);

    this.ws.addEventListener("message", (msg) => {
      const ev = JSON.parse(msg.data) as Event;
      if (ev.op === undefined) {
        console.debug("websocket received unknown event", ev);
        return;
      }

      switch (ev.op) {
        case 0: {
          if (this.sessionData) {
            this.sessionData.seq = ev.s;
          }
          break;
        }
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

      this._event.set(ev);
      console.debug("websocket received event", ev);
    });

    this.ws.addEventListener("error", (ev) => {
      console.error("websocket error:", ev);
      this._event.set({ op: -1, d: { error: ev } });
    });

    this.ws.addEventListener("close", (ev) => {
      console.debug("websocket closed:", ev);
      this.ws = null;
      this._event.set({ op: -1, d: { close: ev } });
    });

    return this.waitForEvent((ev: Event) => {
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

  private waitForEvent<T>(f: (ev: Event) => T | false): Promise<T> {
    return new Promise((resolve, reject) => {
      let done: T | false | { __rejected: true } = false;

      let unsub: store.Unsubscriber | undefined;
      unsub = this._event.subscribe((ev) => {
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

  private changeStatus(v: string) {
    console.debug(`gateway_worker: status: ${v}`);
    this.status.set(v);
  }
}
