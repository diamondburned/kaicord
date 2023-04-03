import type * as gateway from "#/lib/discord/gateway.js";

interface CommandType<Type extends string, Data, Reply> {
  command: {
    id: number;
    t: Type;
    d: Data;
  };
  reply: { id: number } & ({ readonly res: "error"; v: any } | { readonly res: "ok"; v: Reply });
}

export type ConnectCommand = CommandType<
  "connect",
  {
    session: gateway.SessionData;
    idprop: gateway.IdentifyProperties;
  },
  boolean
>;

export type SendCommand = CommandType<"send", gateway.Command, undefined>;

export type Command = ConnectCommand | SendCommand;

interface EventType<Type extends string, Data> {
  id?: undefined;
  t: Type;
  d: Data;
}

export type Event =
  | EventType<"close", CloseEvent>
  | EventType<"event", gateway.Event>
  | EventType<"status", string>;
