<script lang="ts">
  import QRScanner from "qr-scanner";
  import * as svelte from "svelte";
  import { fly } from "svelte/transition";

  const dispatch = svelte.createEventDispatcher();

  export let open = false;
  export let label = "Submit";

  let videoQR: HTMLVideoElement;
  let videoQROverlay: HTMLDivElement;

  let scanner: QRScanner;
  let result = "";

  svelte.onMount(() => {
    scanner = new QRScanner(
      videoQR,
      ({ data }: QRScanner.ScanResult) => {
        console.log(data);
        if (data && result != data) {
          result = data;
        }
      },
      {
        overlay: videoQROverlay,
        maxScansPerSecond: 8,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      }
    );

    scanner.start();
    return () => scanner.stop();
  });

  function submit() {
    dispatch("scanned", result);
    open = false;
  }
</script>

<dialog id="qr-scanner" open transition:fly={{ duration: 100 }}>
  <header>
    <h4>Scan QR code</h4>
    <button type="button" class="close" on:click={() => (open = false)}>
      <span class="material-symbols-rounded">close</span>
    </button>
  </header>
  <main>
    <!-- svelte-ignore a11y-media-has-caption -->
    <video class="qr-video" bind:this={videoQR} playsinline />
    <div class="qr-video-overlay" bind:this={videoQROverlay} />
    <button type="submit" class="signin" on:click={submit} disabled={!result}>
      {label}
      <!-- {#if resultQR}<small>{resultQR}</small>{/if} -->
    </button>
  </main>
</dialog>

<style>
  #qr-scanner[open] {
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    background-color: var(--color-bg);
    display: flex;
    flex-direction: column;
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

  main video {
    width: 100%;
    height: auto;
    max-height: 100%;
    outline: 2px solid var(--color-blossom);
    border-radius: 4px;
  }

  main div.qr-video-overlay {
    outline: 4px dashed var(--color-blossom);
    border-radius: 8px;
  }

  main div.qr-video-overlay :global(svg.code-outline-highlight) {
    /* Inline styles bad, blame the library. */
    stroke: var(--color-force) !important;
    stroke-width: 6px !important;
    stroke-linecap: round !important;
    border-radius: 8px;
  }
</style>
