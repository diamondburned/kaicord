<script lang="ts">
  import Symbol from "#/components/Symbol.svelte";

  export let name: string;
  export let inline = false;
  export let avatar = false;

  export let url = "";
  export let symbol = "";

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
  <img class="icon" class:inline src={url} {alt} />
{:else if symbol}
  <div class="icon" aria-label={alt}>
    <Symbol name={symbol} />
  </div>
{:else}
  <div class="icon" class:inline aria-label={alt}>
    <p>{initials(name)}</p>
  </div>
{/if}

<style>
  .icon {
    width: 2.25em;
    height: 2.25em;
    margin: 0;
    aspect-ratio: 1/1;
    border-radius: 100px;
  }

  .icon.inline {
    width: 1.5em;
    height: 1.5em;
    margin-bottom: -0.1em;
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
