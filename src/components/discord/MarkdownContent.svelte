<script lang="ts" context="module">
  import * as simplemarkdown from "simple-markdown";

  type outputFn = simplemarkdown.NodeOutput<HTMLElement | string>;

  type outputRuleT = simplemarkdown.ParserRule & {
    elem: outputFn;
  };

  type outputArrayRuleT = simplemarkdown.ArrayRule & {
    elem: simplemarkdown.ArrayNodeOutput<HTMLElement | string>;
  };

  function newDivArray(): HTMLDivElement {
    const div = document.createElement("div");
    div.classList.add("md-array");
    return div;
  }

  function w(
    tag: string,
    inner?: string | HTMLElement,
    attrs?: Record<string, string>
  ): HTMLElement {
    const el = document.createElement(tag);
    if (inner) {
      el.append(inner);
    }
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, v);
      }
    }
    return el;
  }

  function sv<T extends any>(component: T, props: Record<string, any>): HTMLElement {
    const div = newDivArray();
    new (component as any)({
      target: div,
      props,
    });
    return div;
  }

  const rules: Record<string, outputRuleT> = {
    blockQuote: {
      ...discordmarkdown.rules.blockQuote,
      elem: (node, elem, state) => w("blockquote", elem(node.content, state)),
    },
    codeBlock: {
      ...discordmarkdown.rules.codeBlock,
      elem: (node) => w("pre", w("code", node.content), { "data-lang": node.lang }),
    },
    newline: {
      ...discordmarkdown.rules.newline,
      elem: () => "\n",
    },
    escape: {
      // What is this even for?
      ...discordmarkdown.rules.escape,
      elem: (node, elem, state) => {
        console.log("escape: rendering", node);
        return elem(node.content, state);
      },
    },
    autolink: {
      ...discordmarkdown.rules.autolink,
      elem: (node) => {
        const href = node.target.replaceAll("https?://", ""); // honestly?
        return w("a", href, { href, target: "_blank" });
      },
    },
    url: {
      ...discordmarkdown.rules.url,
      elem: (node) => {
        const href = node.target.replaceAll("https?://", "");
        return w("a", href, { href, target: "_blank" });
      },
    },
    em: {
      ...discordmarkdown.rules.em,
      elem: (node, elem, state) => w("em", elem(node.content, state)),
    },
    strong: {
      ...discordmarkdown.rules.strong,
      elem: (node, elem, state) => w("strong", elem(node.content, state)),
    },
    underline: {
      ...discordmarkdown.rules.underline,
      elem: (node, elem, state) => w("u", elem(node.content, state)),
    },
    strikethrough: {
      ...discordmarkdown.rules.strikethrough,
      elem: (node, elem, state) => w("s", elem(node.content, state)),
    },
    inlineCode: {
      ...discordmarkdown.rules.inlineCode,
      elem: (node) => w("code", node.content),
    },
    text: {
      ...discordmarkdown.rules.text,
      elem: (node) => {
        console.log("text: rendering", node);
        return node.content;
      },
    },
    // Emoticon is not to be confused with emoji. Emoticons are the old-school
    // emoticons like the shrug thing.
    emoticon: {
      ...discordmarkdown.rules.emoticon,
      elem: (node, elem, state) => w("span", elem(node.content, state), { class: "emoticon" }),
    },
    br: {
      ...discordmarkdown.rules.br,
      elem: () => w("br"),
    },
    spoiler: {
      ...discordmarkdown.rules.spoiler,
      elem: (node, elem, state) => w("span", elem(node.content, state), { class: "md-spoiler" }),
    },
    user: {
      ...discordmarkdown.rules.user,
      elem: (node, _, state) => {
        return sv(MentionUser, {
          state: state.state,
          guildID: state.guildID,
          userID: node.id,
        });
      },
    },
    channel: {
      ...discordmarkdown.rules.channel,
      elem: (node, _, state) => {
        return sv(MentionChannel, {
          state: state.state,
          channelID: node.id,
        });
      },
    },
    role: {
      ...discordmarkdown.rules.role,
      // I can't handle this yet.
      elem: (node) => `<mark class="md-role" data-id="${node.id}">@#${node.id}</mark>`,
    },
    emoji: {
      ...discordmarkdown.rules.emoji,
      elem: (node) => {
        return sv(Emoji, {
          id: node.id,
          name: node.name,
          animated: node.animated,
        });
      },
    },
    everyone: {
      ...discordmarkdown.rules.everyone,
      elem: () => `<mark class="md-everyone">@everyone</mark>`,
    },
    here: {
      ...discordmarkdown.rules.here,
      elem: () => `<mark class="md-here">@here</mark>`,
    },
    twemoji: {
      ...discordmarkdown.rules.twemoji,
      elem: (node) => node.name,
    },
    timestamp: {
      ...discordmarkdown.rules.timestamp,
      // TODO: give a fuck
      elem: (node) => w("mark", node.timestamp, { class: "md-timestamp" }),
    },
  };

  const arrayRules: Record<string, outputArrayRuleT> = {
    Array: {
      elem: (array, elem, state) => {
        if (array.length == 1) {
          return elem(array[0], state);
        }

        const div = newDivArray();
        for (const e of array) {
          div.append(elem(e, state));
        }
        return div;
      },
    },
  };

  const contentRenderer = simplemarkdown.outputFor(
    {
      ...rules,
      ...arrayRules,
    },
    "elem"
  );
</script>

<script lang="ts">
  import * as discord from "#/lib/discord/discord.js";
  import * as discordmarkdown from "discord-markdown-parser";

  import { State } from "#/lib/discord/state.js";

  import Emoji from "#/components/discord/Emoji.svelte";
  import MentionUser from "#/components/discord/MentionUser.svelte";
  import MentionChannel from "#/components/discord/MentionChannel.svelte";

  export let state: State;
  export let content: string;
  export let guildID: discord.ID | undefined;
  export let isEmbed = false;

  let span: HTMLSpanElement | undefined;

  $: ast = discordmarkdown.parse(content, isEmbed ? "extended" : "normal");
  $: out = contentRenderer(ast, {
    state,
    guildID,
  });

  $: onlyEmoji = ast.length == 1 && ast[0].type == "emoji";
  $: onlyURL = ast.length == 1 && ["url", "autolink"].includes(ast[0].type);

  $: {
    if (span) {
      span.innerHTML = "";
      span.append(out);
    }
  }
</script>

<span
  class="md-content"
  class:md-only-emoji={onlyEmoji}
  class:md-only-url={onlyURL}
  bind:this={span}
/>

<style lang="scss">
  :global(div.md-array) {
    display: contents;
  }

  .md-content.md-only-emoji :global(.md-emoji > .icon) {
    --size: 2.5em;

    @media (max-width: $tiny-width) {
      --size: 2.25em;
    }
  }
</style>
