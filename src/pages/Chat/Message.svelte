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
  import Icon from "#/components/Icon.svelte";

  export let message: Message;
  export let compact: boolean = false;

  // Workaround for Svelte limitation.
  $: author = message.author;
  $: roles = $author.guild ? $author.roles : null;
  $: color = roles && $roles ? rolesColor($roles) : 0;
  $: id = message.sending ? undefined : message.id;

  function rolesColor(roles: discord.GuildRole[]): string {
    roles.sort((a, b) => b.position - a.position);
    const role = roles.find((role) => role.color !== 0);
    return role ? `#${role.color.toString(16).padStart(6, "0")}` : "";
  }
</script>

<section
  {id}
  tabindex="-1"
  class="message"
  class:compact
  class:sending={message.sending && !message.error}
>
  {#if !compact}
    <aside>
      <Icon url={discord.userAvatar($author)} name={$author.username} avatar={true} />
    </aside>
    <p class="header">
      <span class="author" title={$author.username} style="--role-color: {color}">
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
    <p class="text">
      {#if message.content}
        {message.content}
      {:else}
        <span class="info">No content</span>
      {/if}
      {#if !message.sending && message.editedTimestamp}
        <time class="edited" datetime={message.editedTimestamp.toISOString()}> (edited) </time>
      {/if}
    </p>
    {#if message.sending && message.error}
      <p class="error">{message.error}</p>
    {/if}
  </div>
</section>

<style>
  .message {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    align-items: flex-start;
    margin: 0;
  }

  .message > aside {
    grid-area: 1/ 1/ 3/ 2;
  }
  .message > .header {
    grid-area: 1/ 2/ 2/ 3;
  }
  .message > .body {
    grid-area: 2/ 2/ 3/ 3;
  }

  .message.sending {
    opacity: 0.45;
  }

  .message > aside {
    margin-top: 0.25em;
    text-align: center;
    width: 3.5em;
  }

  .message:not(.compact) {
    padding-top: 0.5em;
  }

  .message.compact {
    padding-top: 0.25em;
    margin-left: 3.5em;
  }

  .header {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    margin: 0;
    gap: 0.25em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .header * {
    margin: 0;
  }

  .header .author {
    font-size: 0.95em;
    font-weight: 600;
    color: var(--role-color);
  }

  .header .timestamp {
    font-size: 0.8em;
    opacity: 0.85;
  }

  .body {
    margin-right: 0.5em;
  }

  .body p {
    margin: 0;
    line-height: 1.35em;
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

  @media (max-width: 250px) {
    .message > aside {
      grid-area: 1 / 1 / 2 / 2;
    }
    .message > .header {
      grid-area: 1/ 2/ 2/ 3;
    }
    .message > .body {
      grid-area: 2/ 1/ 3/ 3;
    }

    .message > aside {
      width: auto;
      margin: 0 0.5em;
      margin-right: 0.35em;
    }

    /* Icon */
    .message > aside > :global(*) {
      width: 1.5em;
      height: 1.5em;
      margin-bottom: -0.1em;
      vertical-align: top;
    }

    .message.compact {
      margin-left: 0;
    }

    .message .body {
      margin: 0 0.5em;
    }
  }
</style>
