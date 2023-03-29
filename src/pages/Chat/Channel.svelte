<script lang="ts" context="module">
  export function channelIcon(channel: discord.Channel): string {
    switch (channel.type) {
      case discord.ChannelType.DirectMessage:
        return "person";
      case discord.ChannelType.GroupDM:
        return "group";
      case discord.ChannelType.GuildText:
      case discord.ChannelType.GuildPublicThread:
      case discord.ChannelType.GuildPrivateThread:
        return "tag";
      case discord.ChannelType.GuildCategory:
      case discord.ChannelType.GuildDirectory:
        return "folder";
      case discord.ChannelType.GuildVoice:
      case discord.ChannelType.GuildStageVoice:
        return "mic";
      case discord.ChannelType.GuildNews:
      case discord.ChannelType.GuildNewsThread:
        return "newspaper";
      case discord.ChannelType.GuildStore:
        return "shopping_cart";
      case discord.ChannelType.GuildForum:
        return "question_answer";
      default:
        return "help";
    }
  }
</script>

<script lang="ts">
  import * as store from "svelte/store";
  import * as svelte from "svelte";
  import * as discord from "#/lib/discord/discord.js";

  import Icon from "#/components/Icon.svelte";

  export let channel: discord.Channel;
  export let selected = false;
  export let mentions = 0;

  const dispatch = svelte.createEventDispatcher<{ select: discord.Channel }>();
  const iconSize = "2em";

  // svelte moment
  let guild: store.Readable<discord.Guild>;
  let recipients: store.Readable<discord.User[]>;

  // Holy fuck, I fucking hate both Svelte and TypeScript. This shit is fucking
  // miserable. Have a look at:
  //
  // - https://github.com/microsoft/TypeScript/issues/49111
  // - https://github.com/sveltejs/language-tools/issues/1341
  // - https://github.com/sveltejs/svelte/issues/4079
  //
  // This is dogshit! It's fucking awful! How could anyone have missed these?
  // What the fuck? At least give me something that fucking works.
  $: {
    switch (channel.type) {
      case discord.ChannelType.DirectMessage:
      case discord.ChannelType.GroupDM:
        recipients = channel.recipients;
        break;
      default:
        guild = channel.guild;
        break;
    }
  }

  function channelIsThread(channel: discord.Channel): boolean {
    switch (channel.type) {
      case discord.ChannelType.GuildPublicThread:
      case discord.ChannelType.GuildPrivateThread:
      case discord.ChannelType.GuildNewsThread:
        return true;
      default:
        return false;
    }
  }
</script>

<button
  id="channel-{channel.id}"
  class="channel"
  class:selected
  class:mentioned={!!mentions}
  on:click={() => dispatch("select", channel)}
  tabindex="0"
>
  {#if channel.type == discord.ChannelType.DirectMessage}
    <Icon
      url={discord.userAvatar($recipients[0])}
      size={iconSize}
      name={$recipients[0].username}
      symbol={channelIcon(channel)}
      avatar={true}
    />
    <p class="name">{discord.channelName(channel)}</p>
  {:else if channel.type == discord.ChannelType.GroupDM}
    <Icon symbol={channelIcon(channel)} size={iconSize} name={discord.channelName(channel)} />
    <p class="name">{discord.channelName(channel)}</p>
  {:else}
    <div class="guild-icon">
      <Icon symbol={channelIcon(channel)} size={iconSize} name={discord.channelName(channel)} />
      {#if channelIsThread(channel)}
        <Icon symbol="chat_bubble" name="thread" />
      {/if}
    </div>
    <p class="name">
      {discord.channelName(channel, false)}
      <br />
      <small>
        <Icon url={discord.guildIcon($guild, false)} name={$guild.name} inline={true} />
        {$guild.name}
      </small>
    </p>
  {/if}
  <aside>
    {#if mentions}
      <span class="mentions">{mentions}</span>
    {/if}
  </aside>
</button>

<style>
  .channel {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.4em;

    /* Reset sakura.css' button styling. */
    border: none;
    border-radius: 0;
    background: none;
    width: 100%;
    text-align: left;
    color: var(--color-text);
  }

  .channel.selected {
    background: var(--color-bg-alt);
  }

  .channel:hover,
  .channel:focus {
    background: var(--color-bg);
  }

  .name small {
    font-size: 0.85em;
  }

  aside:empty {
    display: none;
  }

  .channel .name {
    margin: 0;
    font-size: 0.9em;
    line-height: 1.15em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .guild-icon {
    position: relative;
  }

  .guild-icon > :global(.icon:not(:first-child)) {
    width: 0.75em;
    height: 0.75em;
    outline: 2px solid var(--color-bg-2);
    position: absolute;
    bottom: 0;
    right: 0;
  }

  .guild-icon > :global(.icon:not(:first-child) > .material-symbols-rounded) {
    font-size: 0.5em;
    font-weight: 900;
  }
</style>
