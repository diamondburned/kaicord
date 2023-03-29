<!--
  Inspired by Adw.ViewStack:
  https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.ViewStack.html
-->
<script lang="ts">
  export let values: string[];
  export let value: string;
  export let id: string;

  let nav: HTMLElement | undefined;

  function onNavKey(event: KeyboardEvent) {
    if (!nav) {
      // Not focused.
      return;
    }

    console.log("ViewSwitcher is visible, handling keyboard event", event);
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        let ix = values.indexOf(value);
        switch (event.key) {
          case "ArrowLeft":
            ix = Math.max(0, ix - 1);
            break;
          case "ArrowRight":
            ix = Math.min(values.length - 1, ix + 1);
            break;
        }
        value = values[ix];
        console.log("arrow key pressed, switching to", value);
        break;
      }
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

<style>
  nav {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    background-color: var(--color-bg-2);
  }

  nav > input {
    display: none;
  }

  nav > label {
    padding: 0; /* KaiOS */
    color: var(--color-text); /* KaiOS */
    margin-bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 75ms ease;
    border-bottom: 2px solid transparent;
    border-top: 2px solid transparent;
  }

  /* KaiOS-specific */
  nav > label::before,
  nav > label::after {
    display: none;
  }

  nav > input:checked + label {
    border-bottom: 2px solid var(--color-force);
    background-color: #7289da66;
  }

  nav > input:hover + label {
    background-color: #7289da33;
  }
</style>
