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

  import Loading from "#/components/Loading.svelte";

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

<div id="qr-login" role="dialog" aria-labelledby="qr-title">
  <header>
    <h4 id="qr-title">
      QR code
      {#if $qr && $qr.ready}
        <small>
          <time datetime={$qr.until.toISOString()}>
            ({countdown})
          </time>
        </small>
      {/if}
    </h4>
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
            Waiting to be scanned...
          {/if}
        </p>
      {:else}
        <Loading size={32} />
        <p class:error={$qr.error}>
          {#if $qr.error}
            Error: {$qr.error}
            <br />
          {/if}
          Retrying...
        </p>
      {/if}
    {:else}
      <Loading size={32} />
      <p class="loading">Loading...</p>
    {/if}
  </main>
</div>

<style>
  /* It was a mistake to use dialog for this. */
  #qr-login {
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    background-color: var(--color-bg);
    color: var(--color-text);
    display: flex;
    position: absolute;
    flex-direction: column;
    z-index: 1;
  }

  header {
    width: 100%;
    display: flex;
    justify-content: space-between;
  }

  header h4 {
    margin: 0.35em 0;
    padding: 0 0.5em;
    font-size: 1.25em;
  }

  header h4 small {
    font-weight: normal;
  }

  header button.close {
    padding: 0;
    align-self: flex-start;
    width: 2em;
    height: 2em;
    margin: 0.25em;
  }

  header button.close span.material-symbols-rounded {
    margin: 0;
    font-size: 28px;
    vertical-align: middle;
  }

  main {
    flex: 1;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
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
    max-width: 400px;
    height: auto;
    margin: 0 auto;
    max-height: 100%;
    border-radius: 4px;
  }
</style>
