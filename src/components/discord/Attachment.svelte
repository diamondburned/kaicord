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

  $: alt = `${attachment.filename} (${prettyBytes(attachment.size)})`;
  $: type = attachment.type ? attachment.type.split("/")[0] : "";
  $: icon = mimeIcon(type);
  $: title = attachment.description;
</script>

<div class="attachment">
  {#if type == "image"}
    <a class="attachment-image" href={attachment.url}>
      <img class="attachment-image" src={attachment.proxyURL} {alt} />
    </a>
  {:else if type == "video"}
    <!-- svelte-ignore a11y-media-has-caption -->
    <video class="attachment-video" src={attachment.proxyURL} {title} controls />
  {:else if type == "audio"}
    <audio class="attachment-audio" src={attachment.proxyURL} {title} controls />
  {:else}
    <div class="attachment-file">
      <Symbol name={icon} tooltip={attachment.type} large />
      <div class="attachment-info">
        <a class="attachment-filename" href={attachment.proxyURL}>{attachment.filename}</a>
        <small class="attachment-size">{prettyBytes(attachment.size)}</small>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  a.attachment-image {
    display: block;
    width: fit-content;

    &,
    &:hover {
      border: none;
    }
  }

  img,
  video,
  audio {
    width: auto;
    height: 100%;
    max-width: min(100%, 350px);
    max-height: 400px;
    margin: 0;

    @media (max-width: $kaios-width) {
      max-height: #{$kaios-width};
    }

    @media (max-width: $tiny-width) {
      max-height: #{$tiny-width};
    }
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
</style>
