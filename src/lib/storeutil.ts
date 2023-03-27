import * as store from "svelte/store";

// Pointer is a helper class that is effectively a read-only pointer to a value
// within a store. It does this by providing an accessor to the value within the
// store instead of storing the value itself.
export class Pointer<Store, T> {
  constructor(private store: store.Readable<Store>, private get_: (v: Store) => T) {}
  get(): T {
    return this.get_(store.get(this.store));
  }
}
