<script lang="ts">
  import "#/sakura.scss";

  import TextualHRule from "#/components/TextualHRule.svelte";
  import Loading from "#/components/Loading.svelte";
  import QRLogin from "#/pages/Login/QRLogin.svelte";
  import { Result as QRLoginResult } from "#/pages/Login/QRLogin.svelte";

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

  function onQRDone(event: CustomEvent<QRLoginResult>) {
    qr = false;
    switch (event.detail.type) {
      case "success": {
        token = event.detail.user.token;
        login();
        break;
      }
      case "error": {
        error = `${event.detail.error}`;
        break;
      }
    }
  }

  // Try to log in on mount in case we have the token saved.
  svelte.onMount(() => login());
</script>

{#if qr}
  <QRLogin on:done={onQRDone} />
{/if}

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
        <formset>
          <button type="submit" disabled={!token}>Login</button>
        </formset>
        <TextualHRule text="or" />
        <button type="button" disabled={!!token} on:click={() => (qr = true)}>
          <span class="material-symbols-rounded">qr_code_scanner</span>
          Login with QR
        </button>
      </formset>
    </form>
  </main>
{/await}

<style>
  main,
  div.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: calc(100%);
    min-height: 100%;
    box-sizing: border-box;
  }

  main {
    max-width: 300px;
    margin: 0 auto;
    padding: 1rem;
    align-items: flex-start;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
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

  .material-symbols-rounded {
    font-size: 1.5em;
    margin-top: -0.5em;
    vertical-align: text-bottom;
  }
</style>
