import * as store from "svelte/store";
import * as api from "#/lib/discord/api.js";
import * as discord from "#/lib/discord/discord.js";
import * as persistent from "#/lib/persistent.js";

import Worker from "#/lib/discord/gateway_worker.js?worker";
import type * as gatewayworker from "#/lib/discord/gateway_worker_decls.js";

export type SessionData = {
  token: string;
  session_id?: string;
  seq?: number;
};

// GatewayURL is the URL of the Discord gateway.
export const GatewayURL = "wss://gateway.discord.gg/?v=9&encoding=json";

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
  public readonly status: store.Readable<string>;

  private worker: Worker;
  private workerSerial = 0;
  private workerPending = new Map<
    number,
    {
      resolve: (arg0: any) => void;
      reject: (arg0: any) => void;
    }
  >();

  private _event = store.writable<Event>({ op: null });
  private _status = store.writable("");
  private session?: SessionData;

  constructor(
    public readonly client: api.Client,
    public readonly key = "gw_state",
    public readonly idprop = defaultIdentifyProperties()
  ) {
    this.token = persistent.writable(`${key}_token`, null);
    this.status = store.readonly(this._status);

    this.event = store.readonly(this._event);
    this.event.subscribe((event) => {
      if (event.op == 0 && this.session) {
        this.session.seq = event.s;
        if (event.t == "READY") {
          this.session.session_id = event.d.session_id;
        }
      }
    });

    this.worker = new Worker();
    this.worker.onmessage = (
      ev: MessageEvent<gatewayworker.Command["reply"] | gatewayworker.Event>
    ) => {
      if (ev.data.id) {
        // is reply
        const promise = this.workerPending.get(ev.data.id);
        if (!promise) {
          console.error("gateway: received reply for unknown id", ev.data.id);
          return;
        }

        switch (ev.data.res) {
          case "error":
            promise.reject(ev.data.v);
            break;
          case "ok":
            promise.resolve(ev.data.v);
            break;
        }

        this.workerPending.delete(ev.data.id);
        return;
      }

      // TypeScript limitation
      if (ev.data.id == undefined) {
        // is event
        switch (ev.data.t) {
          case "close": {
            this._event.set({ op: -1, d: { close: ev.data.d } });
            break;
          }
          case "event": {
            this._event.set(ev.data.d);
            break;
          }
          case "status": {
            this._status.set(ev.data.d);
            break;
          }
        }
      }
    };
  }

  async send(command: Command) {
    await this.workerDo<gatewayworker.SendCommand>("send", command);
  }

  // open opens the Discord gateway. False is returned if a token is needed.
  // True is returned if the session has been successfully opened. At this
  // point, .token will return a valid token.
  async open(token?: string): Promise<boolean> {
    if (!this.session) {
      if (!token) {
        token = store.get(this.token) ?? undefined;
      }
      if (!token) {
        console.debug("gateway: no token saved, returning false");
        return false;
      }
      this.session = {
        token,
      };
    }

    return await this.workerDo<gatewayworker.ConnectCommand>("connect", {
      session: this.session,
      idprop: this.idprop,
    });
  }

  private async workerDo<T extends gatewayworker.Command>(
    t: T["command"]["t"],
    d: T["command"]["d"]
  ): Promise<Extract<T["reply"], { res: "ok" }>["v"]> {
    return await new Promise((ok, error) => {
      const sendingCommand = {
        id: this.workerSerial++,
        t,
        d,
      };
      this.workerPending.set(sendingCommand.id, { resolve: ok, reject: error });
      this.worker.postMessage(sendingCommand);
    });
  }
}
