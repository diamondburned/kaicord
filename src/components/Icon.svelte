<script lang="ts">
  import Symbol from "#/components/Symbol.svelte";

  export let name: string;
  export let inline = false;
  export let avatar = false;

  export let url = "";
  export let symbol = "";
  export let size = inline ? "1.5em" : "2.25em";

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
  <img class="icon" class:inline src={url} {alt} style="--size: {size}" />
{:else if symbol}
  <div class="icon" aria-label={alt} style="--size: {size}">
    <Symbol name={symbol} />
  </div>
{:else}
  <div class="icon" class:inline aria-label={alt} style="--size: {size}">
    <p>{initials(name)}</p>
  </div>
{/if}

<style>
  .icon {
    width: var(--size);
    height: var(--size);
    margin: 0;
    aspect-ratio: 1/1;
    border-radius: 100px;
  }

  .icon.inline {
    vertical-align: top;
  }

  div.icon {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--color-bg-alt);
  }

  div.icon p {
    font-size: 1.5em;
    margin: 0;
    color: var(--color-blossom);
  }
</style>
