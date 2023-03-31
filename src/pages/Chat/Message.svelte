<script lang="ts" context="module">
  import * as discord from "#/lib/discord/discord.js";
  import * as store from "svelte/store";

  export type SendingMessage = { readonly sending: true } & {
    author: store.Readable<discord.User>;
    content: string;
    timestamp: Date;
    error?: any;
  };

  export type RegularMessage = { readonly sending?: undefined } & discord.Message;

  export type Message = SendingMessage | RegularMessage;
</script>

<script lang="ts">
  import { state } from "#/lib/local.js";

  import Icon from "#/components/Icon.svelte";
  import Attachment from "#/components/discord/Attachment.svelte";
  import MarkdownContent from "#/components/discord/MarkdownContent.svelte";

  export let message: Message;
  export let channel: discord.Channel;
  export let compact: boolean = false;

  // Workaround for Svelte limitation.
  $: author = message.author;
  $: roles = $author.guild ? $author.roles : null;
  $: color = roles && $roles ? discord.rolesColor($roles) : "";
  $: id = message.sending ? undefined : message.id;

  let guildID: discord.ID | undefined;
  $: {
    switch (channel.type) {
      case discord.ChannelType.DirectMessage:
      case discord.ChannelType.GroupDM:
        guildID = undefined;
        break;
      default:
        guildID = store.get(channel.guild).id;
        break;
    }
  }
</script>

<section {id} class="message" class:compact class:sending={message.sending && !message.error}>
  {#if !compact}
    <aside>
      <Icon url={discord.userAvatar($author)} name={$author.username} avatar={true} />
    </aside>
    <p class="header">
      <span
        class="author"
        title="{$author.username}#{$author.discriminator}"
        style="--role-color: {color}"
      >
        {#if $author.guild && $author.nick}
          {$author.nick}
        {:else}
          {$author.username}
        {/if}
      </span>
      <time
        class="timestamp"
        title={message.timestamp.toLocaleString()}
        datetime={message.timestamp.toISOString()}
      >
        at {message.timestamp.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "numeric",
        })}
      </time>
    </p>
  {/if}
  <div class="body">
    {#if message.content || (!message.sending && message.editedTimestamp)}
      <p class="text">
        {#if message.content}
          <MarkdownContent state={$state} content={message.content} {guildID} />
        {/if}
        {#if !message.sending && message.editedTimestamp}
          <time class="edited" datetime={message.editedTimestamp.toISOString()}> (edited) </time>
        {/if}
      </p>
    {/if}
    {#if message.sending && message.error}
      <p class="error">{message.error}</p>
    {/if}
    {#if !message.sending}
      {#if message.attachments}
        <div class="attachments">
          {#each message.attachments as attachment}
            <Attachment {attachment} />
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</section>

<style lang="scss">
  .message {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    align-items: flex-start;
    margin: 0;
    padding-top: 0.25em;

    &.sending {
      opacity: 0.45;
    }

    &.compact {
      margin-left: 3.5em;
      @media (max-width: $tiny-width) {
        margin-left: 0;
      }
    }

    &:not(.compact) {
      padding-top: 0.5em;
    }

    & > aside {
      grid-area: 1/ 1/ 3/ 2;
    }

    & > .header {
      grid-area: 1/ 2/ 2/ 3;
    }

    & > .body {
      grid-area: 2/ 2/ 3/ 3;
    }

    @media (max-width: $tiny-width) {
      & > aside {
        grid-area: 1 / 1 / 2 / 2;
      }

      & > .header {
        grid-area: 1/ 2/ 2/ 3;
      }

      & > .body {
        grid-area: 2/ 1/ 3/ 3;
      }
    }

    aside {
      text-align: center;
      width: 3.5em;

      @media (max-width: $tiny-width) {
        width: auto;
        margin: 0 0.5em;
        margin-right: 0.25em;

        /* Icon */
        & > :global(*) {
          width: 1.5em;
          height: 1.5em;
          margin-bottom: -0.1em;
          vertical-align: top;
        }
      }
    }
  }

  .header {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    margin: 0;
    margin-top: 0.1em;
    gap: 0.25em;
    line-height: 1.25em;

    &,
    * {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    * {
      margin: 0;
    }

    .author {
      font-size: 0.95em;
      font-weight: 600;
      color: var(--role-color);
    }

    .timestamp {
      font-size: 0.8em;
      opacity: 0.85;
    }
  }

  .body {
    margin-right: 0.5em;
    margin-top: auto;
    overflow: hidden;

    @media (max-width: $tiny-width) {
      margin: 0 0.5em;
    }

    p {
      margin: 0;
      line-height: 1.25em;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .info,
    .edited {
      font-size: 0.85em;
      opacity: 0.85;
    }

    .info {
      font-style: italic;
    }

    .error {
      font-size: 0.85em;
      color: var(--color-error);
    }

    .attachments > :global(*) {
      margin-top: 0.5em;
    }
  }
</style>
