<script lang="ts">
  import * as discord from "#/lib/discord/discord.js";
  import { State } from "#/lib/discord/state.js";

  import Icon from "#/components/Icon.svelte";

  export let id: discord.ID;
  export let name: string;
  export let animated: boolean;

  // TODO: handle hovering???
  $: url = `https://cdn.discordapp.com/emojis/${id}.png`;
</script>

<span class="md-emoji" data-id={id}>
  <Icon {url} {name} inline emoji />
</span>
