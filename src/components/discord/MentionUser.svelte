<script lang="ts">
  import * as discord from "#/lib/discord/discord.js";
  import { State } from "#/lib/discord/state.js";

  import Icon from "#/components/Icon.svelte";

  export let state: State;
  export let userID: discord.ID;
  export let guildID: discord.ID | undefined;

  function trimRGB(rgb: string): string {
    return rgb.replace(/rgb\((\d+), (\d+), (\d+)\)/, "$1, $2, $3");
  }

  const reactiveUser = state.user(guildID ?? null, userID);
  // Holy fuck.
  $: user = $reactiveUser;
  $: name = user ? (user.guild && user.nick ? user.nick : user.username) : "";
  $: roles = user ? (user.guild && user.roles ? user.roles : null) : null;
  $: color = roles && $roles ? trimRGB(discord.rolesColor($roles, { rgb: true })) : "";
  $: avatar = user ? discord.userAvatar(user) : undefined;
</script>

<mark class="md-user" data-id={userID} style="--role-rgb: {color}">
  <Icon url={avatar} {name} inline avatar />
  <span>{name}</span>
</mark>

<style lang="scss">
  .md-user {
    --role-rgb: #{red($color-bg-alt)}, #{green($color-bg-alt)}, #{blue($color-bg-alt)};

    color: var(--color-text);
    background-color: rgba(var(--role-rgb), 0.5);
    border-radius: 50px;
    padding-right: 0.45em;
    display: inline-block;
    height: 1.5em;

    &,
    span {
      vertical-align: top;
    }
  }
</style>
