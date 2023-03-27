<script lang="ts" context="module">
  import * as discord from "#/lib/discord/discord.js";

  export type Channel = discord.Channel & {
    mentions?: number;
  };
</script>

<script lang="ts">
  import * as svelte from "svelte";

  import ChannelItem from "#/pages/Chat/Channel.svelte";

  export let channels: Channel[];
  export let selected: Channel | null = null;

  const dispatch = svelte.createEventDispatcher<{ select: discord.Channel }>();

  $: filteredChannels = channels.filter((channel) => discord.TextChannelTypes.has(channel.type));
</script>

<div class="channel-list">
  {#each filteredChannels as channel}
    <ChannelItem
      {channel}
      mentions={channel.mentions}
      selected={channel === selected}
      on:select={() => dispatch("select", channel)}
    />
  {/each}
</div>
