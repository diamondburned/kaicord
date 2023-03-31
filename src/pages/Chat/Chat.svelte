<script lang="ts">
  import * as store from "svelte/store";
  import * as local from "#/lib/local.js";
  import * as search from "#/lib/discord/search.js";
  import * as discord from "#/lib/discord/discord.js";

  import BottomViewport from "#/components/BottomViewport.svelte";
  import ViewSwitcher from "#/components/ViewSwitcher.svelte";
  import ChannelList from "#/pages/Chat/ChannelList.svelte";
  import MessageView from "#/pages/Chat/MessageView.svelte";
  import { fade } from "svelte/transition";

  enum Sidebar {
    Search = "Search",
    Inbox = "Inbox",
    Browse = "Browse",
  }

  const session = local.session;
  const trackedRecents = local.recentChannels;

  let recentChannels: discord.Channel[] = [];

  let searchInput = "";
  let searcher = new search.ChannelSearcher($session.state);

  let current: discord.Channel | null = null;
  function onSelectEvent(event: CustomEvent<discord.Channel>) {
    sidebarForceOpen = false;

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

  let sidebar = Sidebar.Inbox;
  let sidebarForceOpen = false; // only works with @media
  $: sidebarOpen = sidebarForceOpen || current == null;

  $: searchedChannels = searcher.search(searchInput);
  $: mentionedChannels = [] as discord.Channel[]; // TODO
  $: {
    const s = $session;
    if (s) {
      recentChannels = $trackedRecents
        .map((recent) => store.get(s.channel(recent.id)))
        .filter((ch) => ch !== null) as discord.Channel[];
    } else {
      recentChannels = [];
    }
  }
</script>

<div class="container" class:sidebar-open={sidebarOpen}>
  <aside id="sidebar">
    <ViewSwitcher id="sidebar-switcher" values={Object.values(Sidebar)} bind:value={sidebar} />
    {#if sidebar == Sidebar.Search}
      <div id="search" transition:fade|local={{ duration: 100 }}>
        <input
          type="text"
          placeholder="Search channels..."
          bind:value={searchInput}
          on:focus={() => searcher.prepare()}
        />
        <ChannelList
          channels={searchedChannels}
          selected={current}
          on:select={(event) => {
            searchInput = "";
            onSelectEvent(event);
          }}
        />
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

  <BottomViewport>
    <main id="chat">
      <MessageView channel={current} on:menu={() => (sidebarForceOpen = true)} />
    </main>
  </BottomViewport>
</div>

<style lang="scss">
  .container {
    --header-height: clamp(2.5em, 10vh, 3em);
    display: flex;
    width: calc(100%);
    height: calc(100%);
    overflow: hidden;

    @media (max-width: $kaios-width) {
      &.sidebar-open #sidebar {
        left: 0;
      }
    }
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

    @media (max-width: $kaios-width) {
      width: 100%;
      border-right: none;
      left: -100%;
      position: absolute;
      transition: left 150ms ease;
    }

    & > *:not(nav) {
      /* Hack to make Svelte transitions work for this case.
	   Taken from https://svelte.dev/repl/18c5847e8f104fa1b161c54598ec3996 */
      grid-column: 1/2;
      grid-row: 2/3;
    }
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
    flex-direction: column;
  }

  #sidebar > :global(nav),
  #chat > :global(header) {
    min-height: var(--header-height);
    height: auto;
    border-bottom: 1px solid var(--color-bg-alt);
    box-sizing: border-box;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  p.empty {
    opacity: 0.85;
    font-size: 0.85em;
    text-align: center;
  }
</style>
