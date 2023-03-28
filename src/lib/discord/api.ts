import * as discord from "#/lib/discord/discord.js";
import * as gateway from "#/lib/discord/gateway.js";

export type RemoteAuthLogin = {
  request: {
    readonly method: "POST";
    readonly path: "/users/@me/remote-auth/login";
    ticket: string;
  };
  response: {
    encrypted_token: string;
  };
};

export type FetchMessage = {
  request: {
    readonly method: "GET";
    readonly path: `/channels/${discord.ID}/messages`;
    limit?: number;
    around?: discord.ID;
    before?: discord.ID;
    after?: discord.ID;
  };
  response: Message[];
};

export type SendMessageBody = {
  content: string;
  nonce?: string;
  allowed_mentions?: {
    replied_user?: boolean;
  };
  message_reference?: {
    message_id?: discord.ID;
    channel_id?: discord.ID;
    guild_id?: discord.ID;
  };
};

export type SendMessage = {
  request: {
    readonly method: "POST";
    readonly path: `/channels/${discord.ID}/messages`;
  } & (
    | {
        readonly body: "multipart";
        payload_json: SendMessageBody;
        [key: string]: string | Blob | Record<string, unknown>;
      }
    | (SendMessageBody & {
        readonly body?: "json";
      })
  );
  response: Message;
};

export function generateNonce(): string {
  return [
    "kaicord",
    (Date.now() % 86_400_000).toString(36),
    Math.floor(Math.random() * 1_000_000).toString(36),
  ].join("-");
}

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface Action {
  request: {
    readonly method: Method;
    readonly path: string;
  } & (
    | {
        readonly body?: "json";
        [key: string]: unknown;
      }
    | {
        readonly body: "multipart";
        [key: string]: string | Blob | Record<string, unknown>;
      }
  );
  response: unknown;
}

export type Channel = {
  id: string;
  type: discord.ChannelType;
  name: string;
  topic?: string;
  nsfw?: boolean;
  guild_id?: string;
  position?: number;
  // This is correct in Arikawa. I wonder why it doesn't work here?
  recipients?: User[];
  recipient_ids?: string[];
};

export type Guild = {
  id: string;
  name: string;
  icon?: string;
  banner?: string;
  roles: Role[];
  // emojis
};

export type Role = {
  id: string;
  name: string;
  color: number;
  position: number;
};

export type Message = {
  id: string;
  type: discord.MessageType;
  content: string;
  channel_id: string;
  guild_id?: string;
  author: User;
  timestamp: string;
  edited_timestamp?: string;
  attachments: {
    id: string;
    filename: string;
    size: number;
    url: string;
    proxy_url: string;
  }[];
  message_reference?: {
    message_id?: string;
    channel_id?: string;
    guild_id?: string;
  };
  referenced_message?: Message;
};

export type User = {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot?: boolean;
};

export type Member = {
  user: User;
  nick?: string;
  roles: string[];
  avatar?: string;
};

// FetchRequest is the request type used for Fetch.
export type HTTPFetchRequest = {
  url: string;
  method: Method;
  headers: Headers;
  body?: BodyInit;
};

// FetchResponse is the response type used for Fetch.
export type HTTPFetchResponse = {
  status: number;
  header: (key: string) => string | null;
  jsonBody: unknown;
};

// HTTPWSClient is a platform-agnostic HTTP/WebSocket client type. You can
// either use ViteClient (which uses Vite as a CORS proxy) or KaiOSClient.
export interface HTTPWSClient {
  fetch(request: HTTPFetchRequest): Promise<HTTPFetchResponse>;
  websocket(url: string): WebSocket;
}

// KaiOSClient is a KaiOS-specific fetch function. It uses KaiOS' mozSystem
// property in XMLHttpRequest to bypass CORS.
//
// https://github.com/cyan-2048/Discord4KaiOS/blob/main/src/lib/DiscordXHR.ts
export class KaiOSClient implements HTTPWSClient {
  constructor() {}

  fetch(request: HTTPFetchRequest): Promise<HTTPFetchResponse> {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      const xhr = new XMLHttpRequest({ mozSystem: true, mozAnon: true });
      xhr.open(request.method, request.url);
      request.headers.forEach((value, key) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.responseType = "json";
      xhr.onload = () => {
        resolve({
          status: xhr.status,
          header: (key: string) => xhr.getResponseHeader(key),
          jsonBody: xhr.response,
        });
      };
      xhr.onerror = () => {
        reject(new Error("network error"));
      };
    });
  }

  websocket(urlstr: string): WebSocket {
    const url = new URL(urlstr);
    switch (url.host) {
      case "remote-auth-gateway.discord.gg":
        // You're welcome :)
        // Traffic moved over the gateway is encrypted by a locally-generated
        // public/private keypair, so the proxy wouldn't see any of it.
        return new WebSocket(`wss://discord-remote-auth.libdb.so${url.pathname}${url.search}`);
      case "gateway.discord.gg":
      default:
        // The regular gateway is not as heavily guarded by Cloudflare as the
        // remote auth gateway, so we can use it directly.
        return new WebSocket(url);
    }
  }
}

// ViteClient is used during development. It uses Vite's CORS proxy to
// bypass CORS.
export class ViteClient implements HTTPWSClient {
  constructor() {
    if (!import.meta.env.DEV) {
      throw new Error("ViteFetch can only be used in development");
    }
  }

  async fetch(request: HTTPFetchRequest): Promise<HTTPFetchResponse> {
    const url = new URL(request.url);

    let target = request.url;
    if (url.host == "discord.com") {
      target = `/__discord__${url.pathname}${url.search}`;
    }

    console.debug(`ViteClient: proxying ${request.method} ${target}`);

    const resp = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return {
      status: resp.status,
      header: (key: string) => resp.headers.get(key),
      jsonBody: await resp.json(),
    };
  }

  websocket(urlstr: string): WebSocket {
    const proxy = (part: string) => {
      const urlstr = `ws://${location.host}/${part}${url.pathname}${url.search}`;
      console.debug(`ViteClient: proxying websocket ${urlstr}`);
      return new WebSocket(urlstr);
    };

    const url = new URL(urlstr);
    switch (url.host) {
      case "gateway.discord.gg":
        return proxy("__gateway__");
      case "remote-auth-gateway.discord.gg":
        return proxy("__auth_gateway__");
      default:
        return new WebSocket(url);
    }
  }
}

export const Endpoint = "https://discord.com/api/v9";

export class Client {
  static default() {
    let client: HTTPWSClient;
    // TODO: once we figure out why the garbage KaiOSRT is not working, we can
    // actually use it to figure out when to use KaiOSFetch.
    if (import.meta.env.DEV) {
      client = new ViteClient();
    } else {
      client = new KaiOSClient();
    }
    return new Client(client);
  }

  token = "";

  constructor(public readonly client: HTTPWSClient) {}

  async do<T extends Action>(req: T["request"]): Promise<T["response"]> {
    const url = new URL(Endpoint + req.path);
    const method = req.method;

    let body: BodyInit | undefined;
    let headers: Record<string, string> = {
      Authorization: this.token,
    };

    if (req.method == "GET") {
      for (const [k, v] of Object.entries(req)) {
        if (["method", "path"].includes(k)) continue;
        url.searchParams.set(k, String(v));
      }
    } else {
      switch (req.body) {
        case "multipart": {
          const formData = new FormData();
          Object.entries(req)
            .filter((e) => !["method", "path", "body"].includes(e[0]))
            .forEach((e) => {
              const k = e[0];
              const v = e[1];
              if (typeof v == "string" || v instanceof Blob) {
                formData.append(k, v, v instanceof File ? v.name : undefined);
              } else if (typeof v == "object") {
                const json = JSON.stringify(v);
                const blob = new Blob([json], { type: "application/json" });
                formData.append(k, blob);
              } else {
                throw new Error(`unknown body type ${typeof v}`);
              }
            });
          headers["Content-Type"] = "multipart/form-data";
          body = formData;
          break;
        }
        case "json":
        case undefined: {
          const json = { ...req } as Record<string, unknown>;
          delete json.method;
          delete json.path;
          delete json.body;
          headers["Content-Type"] = "application/json";
          body = JSON.stringify(json);
          break;
        }
        default: {
          throw new Error(`unknown body type`);
        }
      }
    }

    const resp = await fetch(url.toString(), {
      method,
      headers,
      body,
    });
    if (!resp.ok) {
      throw new Error(`server returned status ${resp.status} ${resp.statusText}`);
    }

    const json = await resp.json();
    return json;
  }
}
