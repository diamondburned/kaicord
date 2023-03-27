import * as discord from "#/lib/discord/discord.js";
import * as gateway from "#/lib/discord/gateway.js";

export const Endpoint = "https://discord.com/api/v9";

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

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface Action {
  request: {
    readonly method: Method;
    readonly path: string;
    [key: string]: unknown;
  };
  response: unknown;
}

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

  websocket(url: string): WebSocket {
    // Apparently this just works.
    return new WebSocket(url);
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
    const url = new URL(urlstr);
    if (url.host === "gateway.discord.gg") {
      urlstr = `ws://${location.host}/__gateway__${url.pathname}${url.search}`;
      console.debug(`ViteClient: proxying websocket ${urlstr}`);
      return new WebSocket(urlstr);
    }
    return new WebSocket(url);
  }
}

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
      const json = { ...req } as Record<string, unknown>;
      delete json.method;
      delete json.path;
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
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
