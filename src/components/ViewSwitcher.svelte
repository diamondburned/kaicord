<!--
  Inspired by Adw.ViewStack:
  https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.ViewStack.html
-->
<script lang="ts">
  export let selected: string;
  export let values: string[];
  export let id: string;

  let nav: HTMLElement | undefined;

  function onNavKey(event: KeyboardEvent) {
    if (!nav) {
      // Not focused.
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        let ix = values.indexOf(selected);
        switch (event.key) {
          case "ArrowLeft":
            ix = Math.max(0, ix - 1);
            break;
          case "ArrowRight":
            ix = Math.min(values.length - 1, ix + 1);
            break;
        }
        selected = values[ix];
        break;
      }
    }
  }
</script>

<svelte:window on:keydown={onNavKey} />

<nav bind:this={nav} style="--n: {values.length}">
  {#each values as value, i}
    <input type="radio" name="sidebar" id="{id}-{value}" bind:group={selected} value={i} />
    <label for="{id}-{value}">{value}</label>
  {/each}
</nav>

<style>
  nav {
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
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
