import * as store from "svelte/store";

export type CommandType<Type extends string, Data, Reply> = {
  command: {
    id: number;
    type: Type;
    data: Data;
  };
  reply: {
    id: number;
    error?: any;
    result?: Reply;
  };
};

export type EventType<Type extends string, Data> = {
  id?: undefined;
  type: Type;
  data: Data;
};

export class Sender<
  CommandT extends CommandType<string, any, any>,
  EventT2 extends EventType<string, any>,
  EventT = EventT2 & EventType<"starting", void>
> {
  private id = 1;
  private pending = new Map<
    number,
    {
      resolve: (arg0: any) => void;
      reject: (arg0: any) => void;
    }
  >();

  public readonly event = store.writable<EventT | null>(null);

  constructor(public readonly worker: globalThis.Worker) {
    worker.onmessage = (ev: MessageEvent<CommandT["reply"] | EventT>) => {
      if (ev.data.id) {
        // is reply
        const promise = this.pending.get(ev.data.id);
        if (!promise) return;

        if (ev.data.error) promise.reject(ev.data.error);
        else promise.resolve(ev.data.result);
        return;
      }

      // TypeScript limitation
      if (ev.data.id == undefined) {
        // is event
        this.event.set(ev.data);
        return;
      }
    };
  }

  async send<Type, Command extends Extract<CommandT, { command: { type: Type } }>>(
    type: Type,
    input: Command["command"]
  ): Promise<Command["reply"]> {
    return new Promise((resolve, reject) => {
      const msg: CommandType<string, any, any>["command"] = {
        id: this.id++,
        type: type as string,
        data: input,
      };
      this.pending.set(msg.id, { resolve, reject });
      this.worker.postMessage(msg);
    });
  }
}
