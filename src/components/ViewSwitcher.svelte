<!--
  Inspired by Adw.ViewStack:
  https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.ViewStack.html
-->
<script lang="ts" context="module">
  export type Direction = "left" | "right";
  export type Cycler = <T>(values: T[], current: T, direction: Direction) => T;

  // cycle is a cycler function that goes to the next or previous view, cycling
  // back to the other end of the list when the end is reached.
  export function cycle<T>(values: T[], value: T, direction: Direction): T {
    let ix = values.indexOf(value);
    switch (direction) {
      case "left":
        ix = (ix - 1 + values.length) % values.length;
        break;
      case "right":
        ix = (ix + 1) % values.length;
        break;
    }
    return values[ix];
  }

  // move is a cycler function that goes to the next or previous view
  // but stop at the first or last view.
  export function move<T>(values: T[], value: T, direction: Direction): T {
    let ix = values.indexOf(value);
    switch (direction) {
      case "left":
        ix = Math.max(ix - 1, 0);
        break;
      case "right":
        ix = Math.min(ix + 1, values.length - 1);
        break;
    }
    return values[ix];
  }
</script>

<script lang="ts">
  export let values: string[];
  export let value: string;
  export let id: string;
  export let cycler: Cycler = cycle;

  let nav: HTMLElement | undefined;

  function onNavKey(event: KeyboardEvent) {
    if (!nav) {
      // Not focused.
      return;
    }

    if (document.activeElement) {
      const elem = document.activeElement as HTMLInputElement;
      if (elem.value) {
        // Assume that the user is typing in a text field. Funny coincidence:
        // this check fails if the input is empty, but then the user would not
        // be needing arrow keys to move around the input anyway.
        return;
      }
    }

    switch (event.key) {
      case "ArrowLeft":
        value = cycler(values, value, "left");
        break;
      case "ArrowRight":
        value = cycler(values, value, "right");
        break;
    }
  }
</script>

<svelte:window on:keydown={onNavKey} />

<nav bind:this={nav} style="--n: {values.length}">
  {#each values as v}
    <input type="radio" name="sidebar" id="{id}-{v}" bind:group={value} value={v} />
    <label for="{id}-{v}">{v}</label>
  {/each}
</nav>

<style lang="scss">
  nav {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    background-color: var(--color-bg-2);

    input {
      display: none;
    }

    label {
      padding: 0; /* KaiOS */
      color: var(--color-text); /* KaiOS */
      margin-bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 75ms ease;
      border-bottom: 2px solid transparent;
      border-top: 2px solid transparent;

      /* KaiOS-specific */
      &::before,
      &::after {
        display: none;
      }
    }

    input:checked + label {
      border-bottom: 2px solid var(--color-force);
      background-color: #7289da66;
    }

    input:hover + label {
      background-color: #7289da33;
    }
  }
</style>
