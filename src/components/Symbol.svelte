<script lang="ts">
  export let name: string;
  export let tooltip = "";
</script>

<span class="material-symbols-rounded" title={tooltip}>{name}</span>

<style>
  .material-symbols-rounded {
    cursor: default;
    user-select: none;
    font-size: 1.35em;
  }
</style>
