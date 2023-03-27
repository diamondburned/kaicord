<!-- Taken from https://codepen.io/jake-lee/pen/jrJYON -->
<script>
  export let size = 16;
</script>

<div class="load" style="--size: {size}px" />

<style>
  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @-webkit-keyframes rotate {
    from {
      -webkit-transform: rotate(0deg);
    }
    to {
      -webkit-transform: rotate(360deg);
    }
  }

  .load {
    display: inline-block;
    vertical-align: sub;
    width: var(--size);
    height: var(--size);
    border: solid calc(var(--size) / 8) var(--color-blossom);
    border-radius: 50%;
    border-right-color: transparent;
    border-bottom-color: transparent;
    -webkit-transition: all 0.5s ease-in;
    -webkit-animation-name: rotate;
    -webkit-animation-duration: 1s;
    -webkit-animation-iteration-count: infinite;
    -webkit-animation-timing-function: linear;
    transition: all 0.5s ease-in;
    animation-name: rotate;
    animation-duration: 1s;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
  }
</style>
