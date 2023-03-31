<script lang="ts">
  import Symbol from "#/components/Symbol.svelte";

  export let name: string;
  export let inline = false;
  export let avatar = false;
  export let emoji = false;

  export let url = "";
  export let symbol = "";
  export let size: string | null = null;

  $: alt = avatar ? `${name} avatar` : `${name} icon`;

  function initials(name: string): string {
    return name
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("");
  }
</script>

{#if url}
  <img class="icon" class:inline class:avatar class:emoji src={url} {alt} style="--size: {size}" />
{:else if symbol}
  <div class="icon" class:inline class:avatar class:emoji aria-label={alt} style="--size: {size}">
    <Symbol name={symbol} />
  </div>
{:else}
  <div class="icon" class:inline class:avatar class:emoji aria-label={alt} style="--size: {size}">
    <p>{initials(name)}</p>
  </div>
{/if}

<style lang="scss">
  .icon {
    --size: 2.25em;

    width: var(--size);
    height: var(--size);
    margin: 0;
    aspect-ratio: 1/1;
    border-radius: 100px;
    user-select: none;
    object-fit: contain;

    &.inline {
      --size: 1.5em;

      vertical-align: bottom;
      display: inline-flex;
    }

    &.emoji {
      border-radius: 0;
    }
  }

  div.icon {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #{lighten($color-bg-alt, 10%)};

    p {
      font-size: 1.5em;
      margin: 0;
      color: var(--color-blossom);
    }
  }
</style>
