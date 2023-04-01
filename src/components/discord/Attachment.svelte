<script lang="ts" context="module">
  export function mimeIcon(mimeType: string): string {
    switch (mimeType.split("/")[0]) {
      case "image":
        return "image";
      case "video":
        return "movie";
      case "audio":
        return "audiotrack";
      case "application":
        return "widgets";
      case "text":
        return "text_snippet";
      default:
        return "attachment";
    }
  }
</script>

<script lang="ts">
  import * as discord from "#/lib/discord/discord.js";
  import prettyBytes from "pretty-bytes";

  import Symbol from "#/components/Symbol.svelte";

  export let attachment: discord.Attachment;
  export let gifv = false;

  $: gif = gifv || attachment.type == "image/gif";
  $: alt = `${attachment.filename} (${prettyBytes(attachment.size)})`;
  $: type = attachment.type ? attachment.type.split("/")[0] : "";
  $: icon = mimeIcon(type);
  $: title = attachment.description;
  $: imageURL = attachment.proxyURL + "?format=png";

  function onVideoEvent(event: MouseEvent) {
    const video = event.target as HTMLVideoElement;
    switch (event.type) {
      case "mouseenter":
        video.play();
        break;
      case "mouseleave":
        video.pause();
        video.currentTime = 0;
        break;
    }
  }

  function onImageEvent(event: MouseEvent) {
    const image = event.target as HTMLImageElement;
    switch (event.type) {
      case "mouseenter":
        image.src = attachment.proxyURL;
        break;
      case "mouseleave":
        image.src = imageURL;
        break;
    }
  }
</script>

<div class="attachment">
  {#if type == "image"}
    <a class="attachment-image-link" href={attachment.url} target="_blank">
      <img
        class="attachment-image"
        {alt}
        src={imageURL}
        on:mouseenter={onImageEvent}
        on:mouseleave={onImageEvent}
      />
      {#if gif}
        <div class="attachment-gif-brand">GIF</div>
      {/if}
    </a>
  {:else if type == "video"}
    <!-- svelte-ignore a11y-media-has-caption -->
    <video
      class="attachment-video"
      class:gifv={gif}
      {title}
      src={attachment.proxyURL}
      loop={gif}
      controls={!gif}
      on:mouseenter={onVideoEvent}
      on:mouseleave={onVideoEvent}
    />
    {#if gif}
      <div class="attachment-gif-brand">GIF</div>
    {/if}
  {:else if type == "audio"}
    <audio class="attachment-audio" src={attachment.proxyURL} {title} controls />
  {:else}
    <div class="attachment-file">
      <Symbol name={icon} tooltip={attachment.type} large />
      <div class="attachment-info">
        <a class="attachment-filename" href={attachment.proxyURL} target="_blank">
          {attachment.filename}
        </a>
        <small class="attachment-size">{prettyBytes(attachment.size)}</small>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  .attachment {
    position: relative;
    width: fit-content;
    max-width: min(100%, 350px);
    max-height: 400px;
    overflow: hidden;

    @media (max-width: $kaios-width) {
      max-height: #{$kaios-width};
    }

    @media (max-width: $tiny-width) {
      max-height: #{$tiny-width};
    }
  }

  a.attachment-image-link {
    display: block;
    width: fit-content;
    line-height: 0;

    &,
    &:hover {
      border: none;
    }
  }

  img,
  video,
  audio {
    margin: 0;
  }

  .attachment-file {
    display: flex;
    flex-direction: row;
    gap: 0.35em;

    width: 100%;
    max-width: min(100%, 400px);
    padding: 0.35em;
    box-sizing: border-box;

    background-color: var(--color-bg-2);
    border-radius: 0.5em;
  }

  .attachment-info {
    overflow: hidden;

    display: flex;
    flex-direction: column;
    justify-content: start;

    a {
      line-height: 1.25em;
      white-space: nowrap;
      text-overflow: ellipsis;

      &,
      &:hover {
        border: none;
      }
    }
  }

  .attachment {
    .attachment-gif-brand {
      position: absolute;
      top: 0;
      right: 0;
      margin: 6px 4px;
      color: black;
      background-color: white;
      opacity: 0.65;
      padding: 0 0.25em;
      border-radius: 6px;
      font-size: 0.75em;
      font-weight: bold;
    }

    &:hover .attachment-gif-brand {
      display: none;
    }
  }
</style>
