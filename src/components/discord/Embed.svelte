<script lang="ts">
  import * as discord from "#/lib/discord/discord.js";
  import { state } from "#/lib/local.js";

  import Icon from "#/components/Icon.svelte";
  import Attachment from "#/components/discord/Attachment.svelte";
  import MarkdownContent from "#/components/discord/MarkdownContent.svelte";

  export let embed: discord.Embed;
  export let guildID: discord.ID | undefined;

  console.log("rendering embed x", embed);

  function basename(path: string) {
    return path.split("/").pop() || "";
  }

  function hasExt(filename: string) {
    return filename.includes(".");
  }

  function thumbnailAsAttachment(
    thumbnail: discord.Embed["thumbnail"],
    { video = false }
  ): discord.Attachment | undefined {
    if (!thumbnail || !thumbnail.url) {
      return;
    }

    return {
      id: "",
      size: 0,
      type: video ? "video" : "image",
      url: thumbnail.url,
      proxyURL: thumbnail.proxyURL || thumbnail.url,
      filename: basename(thumbnail.url),
    };
  }

  $: thumbnail = thumbnailAsAttachment(embed.thumbnail, {});
  $: image = thumbnailAsAttachment(embed.image, {});
  $: video = thumbnailAsAttachment(embed.video, { video: true });

  $: empty = !embed.title && !embed.description && !embed.fields?.length;
  $: attachment = empty ? video || image || thumbnail : undefined;
</script>

{#if attachment}
  <Attachment {attachment} gifv={embed.type == "gifv"} />
{:else}
  <div class="embed" style="--color: {embed.color ? discord.hexColor(embed.color) : null}">
    {#if embed.author}
      <div class="embed-author">
        <a href={embed.author.url} target="_blank">
          {#if embed.author.iconURL}
            <Icon url={embed.author.iconURL} name={embed.author.name ?? ""} inline avatar />
          {/if}
          <span class="embed-author-name">{embed.author.name}</span>
        </a>
      </div>
    {/if}

    {#if embed.title}
      <div class="embed-title">
        <a href={embed.url} target="_blank"><h5>{embed.title}</h5></a>
      </div>
    {/if}

    {#if embed.description}
      <p>
        <MarkdownContent state={$state} {guildID} content={embed.description} />
      </p>
    {/if}

    {#if embed.fields}
      <ul class="embed-fields">
        {#each embed.fields as field}
          <li class="embed-field" class:embed-field-inline={field.inline}>
            <h6 class="embed-field-name">{field.name}</h6>
            <MarkdownContent state={$state} {guildID} content={field.value} />
          </li>
        {/each}
      </ul>
    {/if}

    {#if video && hasExt(video.filename)}
      <div class="embed-video">
        <Attachment attachment={video} />
      </div>
    {:else if image && hasExt(image.filename)}
      <div class="embed-image">
        <Attachment attachment={image} />
      </div>
    {:else if thumbnail && hasExt(thumbnail.filename)}
      <Attachment attachment={thumbnail} />
    {/if}

    {#if embed.footer}
      <div class="embed-footer">
        {#if embed.footer.iconURL}
          <Icon url={embed.footer.iconURL} name="footer" inline />
        {/if}
        <span class="embed-footer-text">{embed.footer.text}</span>
      </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .embed {
    // The trick is to use min-width here and max-width in all the paragraphs.
    // Our max-width will keep things in control.
    width: min-content;
    max-width: min(100%, 450px);

    // This matcher excludes attachments because Svelte sucks. This is actually
    // what we want.
    & > * {
      width: max-content;
      max-width: 100%;
    }

    --margin: 0.75em;

    margin: var(--margin) 0;
    padding: 0 var(--margin);

    & > :global(*) {
      margin: var(--margin) 0;
      margin-bottom: calc(var(--margin) / 2);
    }

    & > :global(*:last-child) {
      margin-bottom: var(--margin);
    }

    color: #{darken($color-text, 10%)};
    background-color: var(--color-bg-2);

    border: 2px solid var(--color);
    border-radius: 12px;
    :global(.attachment) {
      border-radius: 10px;
    }

    font-size: 0.9em;
    line-height: 1.35;

    overflow: hidden;
    word-wrap: break-word;

    h5 {
      font-size: 1.1em;
    }

    h5,
    h6 {
      color: reset;
    }

    a,
    h5,
    h6 {
      margin: 0;
    }

    .embed-fields {
      list-style: none;
      padding: 0;
    }

    @media (max-width: $tiny-width) {
      --margin: 0.5em;
    }
  }
</style>
