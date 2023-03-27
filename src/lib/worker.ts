export type MessageType<Type extends string, T> = {
  id: number;
  type: Type;
  data: T;
};

export type ReplyType<V> = {
  id: number;
  error?: string;
  result?: V;
};

export class Sender {
  private id = 1;
  private pending = new Map<
    number,
    {
      resolve: (arg0: any) => void;
      reject: (arg0: any) => void;
    }
  >();

  constructor(public readonly worker: globalThis.Worker) {
    worker.onmessage = (ev) => {
      if (!ev.data.id) return;

      const promise = this.pending.get(ev.data.id);
      if (!promise) return;

      if (ev.data.error) promise.reject(ev.data.error);
      else promise.resolve(ev.data.result);
    };
  }

  async send<V>(type: string, input: any): Promise<V> {
    return new Promise((resolve, reject) => {
      const msg: MessageType<string, any> = {
        id: this.id++,
        type,
        data: input,
      };
      this.pending.set(msg.id, { resolve, reject });
      this.worker.postMessage(msg);
    });
  }
}
