<script lang="ts">
  import * as discord from "#/lib/discord/discord.js";
  import { State } from "#/lib/discord/state.js";

  import Icon from "#/components/Icon.svelte";
  // TODO: move this out of pages, nothing should import pages
  import { channelIcon } from "#/pages/Chat/Channel.svelte";

  export let state: State;
  export let channelID: discord.ID;

  const reactiveChannel = state.channel(channelID);
  $: channel = $reactiveChannel;
  $: name = channel?.name ?? "Deleted channel";
  $: icon = channel ? channelIcon(channel) : "tag";
</script>

<mark class="md-channel" data-id={channelID}>
  <Icon symbol={icon} {name} inline avatar />
  <span>{name}</span>
</mark>
