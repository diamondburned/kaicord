<script lang="ts">
  import * as store from "svelte/store";
  import * as svelte from "svelte";
  import * as discord from "#/lib/discord/discord.js";

  import Icon from "#/components/Icon.svelte";

  export let channel: discord.Channel;
  export let selected = false;
  export let mentions = 0;

  const dispatch = svelte.createEventDispatcher<{ select: discord.Channel }>();

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
  switch (channel.type) {
    case discord.ChannelType.DirectMessage:
    case discord.ChannelType.GroupDM:
      recipients = channel.recipients;
      break;
    default:
      guild = channel.guild;
      break;
  }
</script>

<button
  id="channel-{channel.id}"
  class="channel"
  class:selected
  class:mentioned={!!mentions}
  on:click={() => dispatch("select", channel)}
>
  {#if channel.type == discord.ChannelType.DirectMessage}
    <Icon url={discord.userAvatar($recipients[0])} name={$recipients[0].username} avatar={true} />
    <p class="name">{discord.channelName(channel)}</p>
  {:else if channel.type == discord.ChannelType.GroupDM}
    <Icon symbol="group" name={discord.channelName(channel)} />
    <p class="name">{discord.channelName(channel)}</p>
  {:else}
    <Icon url={discord.guildIcon($guild, false)} name={$guild.name} />
    <p class="name">
      {discord.channelName(channel)}
      <br />
      <small>{$guild.name}</small>
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

  .channel:hover {
    background: var(--color-bg);
  }

  .channel .name {
    margin: 0;
    margin-right: 0.25em;
    font-size: 0.9em;
    line-height: 1.15em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
