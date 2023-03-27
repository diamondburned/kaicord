<script lang="ts">
  import "#/sakura.scss";

  import QRScanner from "#/pages/Login/QRScanner.svelte";
  import TextualHRule from "#/components/TextualHRule.svelte";
  import Loading from "#/components/Loading.svelte";

  import * as local from "#/lib/local.js";
  import * as svelte from "svelte";

  let promise = Promise.resolve();
  let error = "";
  let token = "";
  let qr = false;

  function login() {
    promise = (async () => {
      try {
        await local.open(token ? token : undefined);
      } catch (err) {
        console.error("login:", err);
        error = `${err}`;
      }
    })();
  }

  function scannedQR(event: CustomEvent<string>) {
    console.log("scanned", event.detail);
  }

  // Try to log in on mount in case we have the token saved.
  svelte.onMount(() => login());
</script>

{#if qr}
  <QRScanner label="Login" bind:open={qr} on:scanned={scannedQR} />
{/if}

<div class="centered">
  {#await promise}
    <div class="loading">
      <Loading size={46} />
    </div>
  {:then}
    <main id="login" class="container">
      <h1>
        Login
        <br />
        <small>to Discord</small>
      </h1>
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <form on:submit|preventDefault={login}>
        <formset>
          <input type="text" placeholder="Token" bind:value={token} />
          <TextualHRule text="or" />
          <button type="button" disabled={!!token} on:click={() => (qr = true)}>
            <span class="material-symbols-rounded">qr_code_scanner</span>
            Scan QR code
          </button>
        </formset>
        <formset>
          <button type="submit" disabled={!qr && !token}>Login</button>
        </formset>
      </form>
    </main>
  {/await}
</div>

<style>
  div.centered {
    display: flex;
    align-items: center;
    height: calc(100%);
  }

  div.loading {
    margin: auto;
  }

  main {
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
    padding: 1rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  formset :global(hr) {
    margin: 0;
  }

  formset > input,
  formset > button {
    width: 100%;
    margin: 1rem 0;
    padding: 1rem;
  }
</style>
