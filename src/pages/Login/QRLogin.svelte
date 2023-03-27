<script lang="ts" context="module">
  import * as remoteauth from "#/lib/discord/remoteauth.js";

  export type Result =
    | { type: "success"; user: remoteauth.User }
    | { type: "error"; error: any }
    | { type: "close" };
</script>

<script lang="ts">
  import * as svelte from "svelte";
  import * as local from "#/lib/local.js";
  import { fly } from "svelte/transition";

  const dispatch = svelte.createEventDispatcher<{ done: Result }>();

  let qr: remoteauth.Client["qr"];
  let countdown = "";

  svelte.onMount(() => {
    function updateCountdown(): string {
      let until = 0;
      if ($qr && $qr.ready) {
        until = $qr.until.getTime();
        const remaining = until - Date.now();
        if (remaining > 0) {
          return `${Math.ceil(remaining / 1000)}s`;
        }
      }
      return "";
    }

    const h = window.setInterval(() => (countdown = updateCountdown()), 1000);
    return () => window.clearInterval(h);
  });

  svelte.onMount(() => {
    const auth = new remoteauth.Client(local.client);
    qr = auth.qr;

    (async () => {
      try {
        const user = await auth.wait();
        dispatch("done", {
          type: "success",
          user,
        });
      } catch (error) {
        dispatch("done", {
          type: "error",
          error,
        });
      }
    })();

    return () => auth.close();
  });
</script>

<dialog id="qr-login" open transition:fly={{ duration: 100 }}>
  <header>
    <h4>QR code</h4>
    <button type="button" class="close" on:click={() => dispatch("done", { type: "close" })}>
      <span class="material-symbols-rounded">close</span>
    </button>
  </header>
  <main>
    {#if $qr}
      {#if $qr.ready}
        <img class="qr" src={$qr.image} alt="QR code" />
        <p class="qr-info">
          {#if $qr.user}
            <br />
            Logging in as
            <span class="username">{$qr.user.username}#{$qr.user.discriminator}</span>.
            <br />
            Please confirm on your phone.
          {:else}
            <time datetime={$qr.until.toISOString()}>
              Valid until {countdown}
            </time>
          {/if}
        </p>
      {:else}
        <p class="error">
          {$qr.error}
          <br />
          Retrying...
        </p>
      {/if}
    {:else}
      <p class="loading">Loading...</p>
    {/if}
  </main>
</dialog>

<style>
  #qr-login[open] {
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    background-color: var(--color-bg);
    display: flex;
    flex-direction: column;
    z-index: 1;
  }

  main,
  header h4 {
    padding: 0 1em;
  }

  header {
    width: 100%;
    display: flex;
    justify-content: space-between;
  }

  header button.close {
    padding: 0;
    align-self: flex-start;
    aspect-ratio: 1/1;
  }

  header button.close span.material-symbols-rounded {
    margin: 0;
    font-size: 28px;
  }

  main {
    flex: 1;

    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  p.error {
    color: var(--color-error);
  }

  p.error,
  p.qr-info {
    max-width: 400px;
    margin: 1em auto;
  }

  p.qr-info .username {
    font-weight: bold;
  }

  main img.qr {
    width: 100%;
    height: auto;
    margin: 0;
    max-height: 100%;
    outline: 2px solid var(--color-blossom);
    border-radius: 4px;
  }
</style>
