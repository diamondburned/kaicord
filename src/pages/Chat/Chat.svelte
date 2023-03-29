<script lang="ts">
  import "#/sakura.scss";

  import * as local from "#/lib/local.js";
  import * as search from "#/lib/discord/search.js";
  import * as discord from "#/lib/discord/discord.js";

  import ChannelList from "#/pages/Chat/ChannelList.svelte";
  import MessageView from "#/pages/Chat/MessageView.svelte";
  import { fade } from "svelte/transition";

  enum Sidebar {
    Search,
    Inbox,
    Browse,
  }

  const session = local.session;
  const trackedRecents = local.recentChannels;

  let sidebar = Sidebar.Inbox;
  let sidebarOpen = false; // only works with @media
  let recentChannels: discord.Channel[] = [];

  let searchInput = "";
  let searcher = new search.ChannelSearcher($session.state);

  let current: discord.Channel | null = null;
  function onSelectEvent(event: CustomEvent<discord.Channel>) {
    sidebarOpen = false;

    const channel = event.detail;
    current = channel;

    trackedRecents.update((recents) => {
      let recent = recents.find((recent) => recent.id === channel.id);
      if (recent) {
        recent.uses++;
        recent.time = Date.now();
      } else {
        recent = {
          id: channel.id || "",
          uses: 1,
          time: Date.now(),
        };
        recents.push(recent);
      }
      recents.sort((a, b) => b.time - a.time);
      return recents;
    });
  }

  $: searchedChannels = searcher.search(searchInput);
  $: mentionedChannels = [] as discord.Channel[]; // TODO
  $: {
    const s = $session;
    if (s) {
      recentChannels = $trackedRecents
        .map((recent) => s.channel(recent.id))
        .filter((ch) => ch !== null) as discord.Channel[];
    } else {
      recentChannels = [];
    }
  }
</script>

<div class="container" class:sidebar-open={sidebarOpen || !current}>
  <aside id="sidebar">
    <nav>
      <input
        type="radio"
        name="sidebar"
        id="select-browse"
        bind:group={sidebar}
        value={Sidebar.Browse}
      />
      <label for="select-browse">Browse</label>
      <input
        type="radio"
        name="sidebar"
        id="select-inbox"
        bind:group={sidebar}
        value={Sidebar.Inbox}
      />
      <label for="select-inbox">Inbox</label>
      <input
        type="radio"
        name="sidebar"
        id="select-search"
        bind:group={sidebar}
        value={Sidebar.Search}
      />
      <label for="select-search">Search</label>
    </nav>
    {#if sidebar == Sidebar.Search}
      <div id="search" transition:fade|local={{ duration: 100 }}>
        <input type="text" bind:value={searchInput} placeholder="Search channels..." />
        <ChannelList channels={searchedChannels} selected={current} on:select={onSelectEvent} />
      </div>
    {:else if sidebar == Sidebar.Inbox}
      <div id="inbox" transition:fade|local={{ duration: 100 }}>
        <section id="mentions">
          <h4>Mentions</h4>
          {#if mentionedChannels.length > 0}
            <ChannelList
              channels={mentionedChannels}
              selected={current}
              on:select={onSelectEvent}
            />
          {:else}
            <p class="empty">No mentions!</p>
          {/if}
        </section>
        <section id="recents">
          <h4>Recents</h4>
          {#if recentChannels.length > 0}
            <ChannelList
              channels={recentChannels.slice(0, 15)}
              selected={current}
              on:select={onSelectEvent}
            />
          {:else}
            <p class="empty">No recent channels!</p>
          {/if}
        </section>
      </div>
    {:else if sidebar == Sidebar.Browse}
      <div id="browse" transition:fade|local={{ duration: 100 }}>
        <p>Unimplemented!</p>
      </div>
    {/if}
  </aside>

  <main id="chat">
    <MessageView channel={current} on:menu={() => (sidebarOpen = true)} />
  </main>
</div>

<style>
  .container {
    --header-height: clamp(2.5em, 10vh, 3em);
    display: flex;
    width: calc(100%);
    height: calc(100%);
    overflow: hidden;
  }

  #sidebar {
    display: grid;
    grid-template-rows: auto 1fr;
    min-height: 100%;
    width: clamp(12em, 25%, 300px);
    border-right: 1px solid var(--color-bg-alt);
    background-color: var(--color-bg-2);
    z-index: 2;
    overflow: auto;
  }

  #sidebar > *:not(nav) {
    /* Hack to make Svelte transitions work for this case.
	   Taken from https://svelte.dev/repl/18c5847e8f104fa1b161c54598ec3996 */
    grid-column: 1/2;
    grid-row: 2/3;
  }

  #search {
    display: grid;
    grid-template-rows: auto 1fr;
    /* Hack that makes ellipsizing work.
	   See https://css-tricks.com/preventing-a-grid-blowout/. */
    grid-template-columns: minmax(0, 1fr);
  }

  #search input {
    width: calc(100%);
    height: clamp(2em, 10vh, 3em);
    margin: 0;
    background-color: transparent;
    border: none;
    border-bottom: 1px solid var(--color-bg-alt);
    border-radius: 0;
    background-color: var(--color-bg-2);
    position: sticky;
    top: var(--header-height);
    z-index: 1;
  }

  #inbox section {
    margin-bottom: 1.5rem;
  }

  #inbox section h4 {
    margin: 0;
    padding: 0.5em;
    font-size: 1em;
    background-color: var(--color-bg-2);
  }

  #chat {
    flex: 1;
    display: flex;
    overflow: auto;
    flex-direction: column;
  }

  nav,
  #chat > :global(header) {
    min-height: var(--header-height);
    height: auto;
    border-bottom: 1px solid var(--color-bg-alt);
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  nav {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background-color: var(--color-bg-2);
  }

  nav > input {
    display: none;
  }

  nav > label {
    padding: 0; /* KaiOS */
    color: var(--color-text); /* KaiOS */
    margin-bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 75ms ease;
    border-bottom: 2px solid transparent;
    border-top: 2px solid transparent;
  }

  /* KaiOS-specific */
  nav > label::before,
  nav > label::after {
    display: none;
  }

  nav > input:checked + label {
    border-bottom: 2px solid var(--color-force);
    background-color: #7289da66;
  }

  nav > input:hover + label {
    background-color: #7289da33;
  }

  p.empty {
    opacity: 0.85;
    font-size: 0.85em;
    text-align: center;
  }

  @media (max-width: 450px) {
    #sidebar {
      width: 100%;
      border-right: none;
      left: -100%;
      position: absolute;
      transition: left 150ms ease;
    }

    .container.sidebar-open #sidebar {
      left: 0;
    }
  }
</style>
