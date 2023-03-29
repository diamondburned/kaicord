<script lang="ts" context="module">
  export type SoftKey = "left" | "center" | "right";
</script>

<script lang="ts">
  import * as svelte from "svelte";

  export let left: string | undefined = undefined;
  export let center: string | undefined = undefined;
  export let right: string | undefined = undefined;
  $: empty = !left && !center && !right;

  const dispatch = svelte.createEventDispatcher<{ press: SoftKey }>();
  let self: HTMLElement | undefined;

  function onKeyDown(event: KeyboardEvent) {
    if (empty || !self) {
      return;
    }

    switch (event.key) {
      case "SoftLeft":
        dispatch("press", "left");
        break;
      case "SoftRight":
        dispatch("press", "right");
        break;
      case "Enter":
        dispatch("press", "center");
        break;
      default:
        return;
    }

    event.preventDefault();
  }
</script>

<svelte:document on:keydown={onKeyDown} />

<footer id="softkeys" class:empty bind:this={self}>
  <div id="softkey-left">
    {#if left}
      <button class="flat" on:click={() => dispatch("press", "left")}>
        {left}
      </button>
    {/if}
  </div>
  <div id="softkey-center">
    {#if center}
      <button class="flat" on:click={() => dispatch("press", "center")}>
        {center}
      </button>
    {/if}
  </div>
  <div id="softkey-right">
    {#if right}
      <button class="flat" on:click={() => dispatch("press", "right")}>
        {right}
      </button>
    {/if}
  </div>
</footer>

<style lang="scss">
  #softkeys {
    position: sticky;
    bottom: 0;
    height: 2em;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    z-index: 10;
    background-color: darken($color-bg, 5%);

    button {
      width: 100%;
      border-radius: 0;

      &:hover {
        background-color: $color-bg;
      }
    }

    #softkey-left button {
      text-align: left;
    }

    #softkey-center button {
      text-align: center;
    }

    #softkey-right button {
      text-align: right;
    }
  }

  #softkeys.empty {
    display: none;
  }

  @media (min-width: calc($kaios-width + 1px)) {
    #softkeys {
      display: none;
    }
  }
</style>
