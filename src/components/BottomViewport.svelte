<!--
  BottomViewport is a component that implements overlfow scrolling but locks
  scrolling to the bottom unless the user scrolls up. It is implemented as a
  wrapper around a <div> element.
-->
<div>
  <slot />
</div>

<style>
  div {
    display: flex;
    flex-direction: column-reverse;
    width: 100%;
    overflow: auto;
  }
</style>
