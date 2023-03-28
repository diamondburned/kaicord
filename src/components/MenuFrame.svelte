<!--
  MenuFrame is a bit of a special component. It doesn't actually implement a
  Menu component, but rather a frame that implements certain behaviors. For
  example, when the user clicks outside of the menu, it should close.
-->
<script lang="ts">
  import { fly } from "svelte/transition";

  export let position: "top" | "bottom" = "top";
  export let anchor: "left" | "right" = "left";
  export let open: boolean = false;

  export let transition = (elem: Element) =>
    fly(elem, {
      y: position === "top" ? -50 : 50,
      duration: 100,
    });

  export let label = "";
  export let id = "";

  let element: HTMLElement | null = null;
  // Keep track of the initial click which is to trigger the open of this menu.
  let initialClick = false;
  function handleClick(ev: MouseEvent) {
    if (!element) {
      return;
    }

    console.log("MenuFrame: handling click", ev);
    if (!initialClick) {
      initialClick = true;
      return;
    }

    if (element && !element.contains(ev.target as Node)) {
      open = false;
      initialClick = false;
    }
  }
</script>

<svelte:window on:click={handleClick} />

{#if open}
  <div
    {id}
    class="position-{position} anchor-{anchor}"
    aria-modal="true"
    aria-label={label}
    transition:transition|local
    bind:this={element}
  >
    <slot />
  </div>
{/if}

<style>
  div {
    position: absolute;
    background-color: var(--color-bg-alt);
    box-sizing: border-box;
    z-index: 1;
  }

  div.position-top {
    bottom: 100%;
  }

  div.position-bottom {
    top: 100%;
  }

  div.anchor-left {
    left: 0;
  }

  div.anchor-right {
    right: 0;
  }
</style>
