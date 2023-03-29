<!--
  SoftKeyNavigable is a component that wraps an entire application with a
  context that controls the bottom soft keys navigation. It uses SoftKeys.svelte
  for the soft keys.
-->
<script lang="ts" context="module">
  import { SoftKey } from "#/components/SoftKeys.svelte";
  import * as store from "svelte/store";

  export type Key = {
    label: string;
    on: () => void;
  };

  export type Keys = { [key in SoftKey]?: Key };
  export type KeysStore = store.Writable<Keys>;

  export const ctx = Symbol();
</script>

<script lang="ts">
  import * as svelte from "svelte";

  import SoftKeys from "#/components/SoftKeys.svelte";
  import { height } from "#/components/SoftKeys.svelte";

  let keys = store.writable<Keys>({});
  svelte.setContext(ctx, keys);

  function handlePress(event: CustomEvent<SoftKey>) {
    const key = $keys[event.detail];
    if (key) {
      key.on();
    }
  }
</script>

<div class="softkeyable">
  <slot />
</div>

<div class="phantom-softkeys" style="--height: {height}" />
<SoftKeys
  left={$keys.left?.label}
  center={$keys.center?.label}
  right={$keys.right?.label}
  on:press={handlePress}
/>

<style>
  div.softkeyable {
    display: contents;
  }

  div.phantom-softkeys {
    height: var(--height);
  }
</style>
