<script lang="ts">
  import "#/styles/sakura.scss";

  import Chat from "#/pages/Chat/Chat.svelte";
  import Login from "#/pages/Login/Login.svelte";
  import SoftKeyNavigable from "#/components/SoftKeyNavigable.svelte";
  import { fade } from "svelte/transition";

  import { connected } from "#/lib/local.js";
</script>

{#if $connected}
  <div transition:fade={{ duration: 100 }}>
    <Chat />
  </div>
{:else}
  <div transition:fade={{ duration: 100 }}>
    <Login />
  </div>
{/if}

<style>
  div {
    display: contents;
  }
</style>
