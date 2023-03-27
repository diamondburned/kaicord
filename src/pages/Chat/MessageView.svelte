<script lang="ts">
  import Loading from "#/components/Loading.svelte";
  import Message from "#/pages/Chat/Message.svelte";
  import Symbol from "#/components/Symbol.svelte";
  import Icon from "#/components/Icon.svelte";

  import * as svelte from "svelte";
  import * as store from "svelte/store";

  import * as discord from "#/lib/discord/discord.js";
  import session from "#/lib/local.js";

  const dispatch = svelte.createEventDispatcher<{ menu: void }>();
  function onMenu() {
    dispatch("menu");
  }

  export let channel: discord.Channel | null;
  let guild: store.Readable<discord.Guild>;

  // Workaround for TypeScript limitation.
  $: {
    if (channel) {
      switch (channel.type) {
        case discord.ChannelType.DirectMessage:
        case discord.ChannelType.GroupDM:
          break;
        default:
          guild = channel.guild;
      }
    }
  }

  let messages: store.Writable<discord.Message[]>;
  let promise: Promise<store.Writable<discord.Message[]>> | null;
  $: {
    if (channel) {
      promise = $session.messages(channel.id).then((m) => (messages = m));
    } else {
      promise = null;
    }
  }

  function shouldBeCompact(messages: discord.Message[], current: number): boolean {
    const compactAge = 1000 * 60 * 5; // 5 minutes
    const curr = messages[current];
    const prev = messages[current + 1];
    if (!prev) return false;
    if (store.get(prev.author).id !== store.get(curr.author).id) return false;
    if (curr.timestamp.getTime() - prev.timestamp.getTime() > compactAge) return false;
    return true;
  }
</script>

<header>
  <button class="menu" on:click={onMenu}>
    <Symbol name="menu" />
  </button>
  {#if channel}
    <h3>
      {discord.channelName(channel)}
      {#if guild}
        <span class="guild">
          —
          <Icon url={discord.guildIcon($guild, false)} name={$guild.name} inline />
          <span class="name">{$guild.name}</span>
        </span>
      {/if}
    </h3>
  {/if}
</header>

{#if channel}
  {#await promise}
    <div class="loading">
      <Loading size={46} />
    </div>
  {:then}
    <div id="messages">
      {#each $messages as message, i}
        <Message {message} compact={shouldBeCompact($messages, i)} />
      {/each}
    </div>
  {/await}
{:else}
  <div class="placeholder">
    <Symbol name="question_answer" />
    <p>Select a channel to start chatting!</p>
  </div>
{/if}

<style>
  header + * {
    flex: 1;
    box-shadow: 0 22px 16px -30px inset rgba(0, 0, 0, 0.85);
  }

  header {
    display: flex;
    align-items: center;
  }

  header h3 {
    font-size: 1em;
    margin: auto 0;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    line-height: 1.5;
  }

  .menu {
    color: var(--color-text);
    background-color: transparent;
    height: 100%;
    border: none;
    display: flex;
    align-items: center;
    padding: 0.25em;
    margin: 0 0.25em;
  }

  .menu:hover {
    background-color: var(--color-bg-2);
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* Svelte fucking sucks. They had a proposal to fix this and they made
	 it fucking garbage. Now we have to do this. */
  .placeholder > :global(*:first-child) {
    display: contents;
    font-size: 7em;
    margin: 0;
  }

  .placeholder p {
    padding: 0 1em;
    text-align: center;
  }

  #messages {
    display: flex;
    flex-direction: column-reverse;
    overflow: auto;
    max-width: 800px;
    margin: auto;
  }

  @media (max-width: 250px) {
    header h3 .guild {
      display: none;
    }
  }
</style>
