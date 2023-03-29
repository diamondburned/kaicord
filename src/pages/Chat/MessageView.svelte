<script lang="ts">
  import MenuFrame from "#/components/MenuFrame.svelte";
  import Loading from "#/components/Loading.svelte";
  import Symbol from "#/components/Symbol.svelte";
  import Icon from "#/components/Icon.svelte";
  import Message from "#/pages/Chat/Message.svelte";

  import { SendingMessage, RegularMessage } from "#/pages/Chat/Message.svelte";
  import { channelIcon } from "#/pages/Chat/Channel.svelte";

  import * as svelte from "svelte";
  import * as store from "svelte/store";
  import * as api from "#/lib/discord/api.js";
  import * as state from "#/lib/discord/state.js";
  import * as discord from "#/lib/discord/discord.js";
  import session from "#/lib/local.js";
  import prettyBytes from "pretty-bytes";

  const dispatch = svelte.createEventDispatcher<{ menu: void }>();
  function onMenu() {
    dispatch("menu");
  }

  export let channel: discord.Channel | null;
  let guild: store.Readable<discord.Guild>;
  let recipients: store.Readable<discord.User[]>;

  // Workaround for TypeScript limitation.
  $: {
    if (channel) {
      switch (channel.type) {
        case discord.ChannelType.DirectMessage:
        case discord.ChannelType.GroupDM:
          recipients = channel.recipients;
          break;
        default:
          guild = channel.guild;
          break;
      }
    }
  }

  let canSendMessage = true;
  $: {
    // TODO: figure out canSendMessage once I care enough
    canSendMessage = true;
  }

  let regularMessages: store.Writable<RegularMessage[]>;
  let sendingMessages = store.writable<SendingMessage[]>([]);

  let promise: Promise<store.Writable<discord.Message[]>> | null;
  $: {
    if (channel) {
      promise = $session.messages(channel.id).then((m) => (regularMessages = m));
    } else {
      promise = null;
    }
  }

  let messages = store.writable<(RegularMessage | SendingMessage)[]>([]);
  $: messages.update(() => {
    const messages: (RegularMessage | SendingMessage)[] = [];
    if (regularMessages) $regularMessages.forEach((m) => messages.push(m));
    if (sendingMessages) $sendingMessages.forEach((m) => messages.push(m));
    // Sort latest first.
    messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return messages;
  });

  function shouldBeCompact(
    messages: (RegularMessage | SendingMessage)[],
    current: number
  ): boolean {
    const compactAge = 1000 * 60 * 5; // 5 minutes
    const curr = messages[current];
    const prev = messages[current + 1];
    if (!prev) return false;
    if (store.get(prev.author).id !== store.get(curr.author).id) return false;
    if (curr.timestamp.getTime() - prev.timestamp.getTime() > compactAge) return false;
    return true;
  }

  const sending = store.writable({
    content: ``,
    attachments: [] as File[],
    send() {
      if (!channel) {
        throw new Error("no channel to send message to");
      }

      let resp: api.SendMessage["request"];
      if (this.attachments.length > 0) {
        resp = {
          method: "POST",
          path: `/channels/${channel.id}/messages`,
          body: "multipart",
          payload_json: {
            content: this.content,
          },
        };
        for (let i = 0; i < this.attachments.length; i++) {
          resp[`file${i}`] = this.attachments[i];
        }
      } else {
        resp = {
          method: "POST",
          path: `/channels/${channel.id}/messages`,
          content: this.content,
        };
      }

      const sending: SendingMessage = {
        sending: true,
        content: this.content,
        author: $session.self,
        timestamp: new Date(),
      };

      sendingMessages.update((sendingMessages) => {
        sendingMessages.push(sending);
        return sendingMessages;
      });

      $session.client
        .do<api.SendMessage>(resp)
        .then(() => {
          sendingMessages.update((sendingMessages) => {
            const index = sendingMessages.indexOf(sending);
            if (index != -1) {
              // It is likely that the gateway will send the message before this
              // request completes, so we'll remove our sending message. This is a
              // hack, but it works.
              sendingMessages.splice(index, 1);
            }
            return sendingMessages;
          });
        })
        .catch((err) =>
          sendingMessages.update((sendingMessages) => {
            console.error("cannot send message:", err);
            const index = sendingMessages.indexOf(sending);
            if (index != -1) {
              sendingMessages[index].error = err;
            }
            return sendingMessages;
          })
        );

      // Reset the message content.
      this.content = ``;
      this.attachments = [];
    },
    addAttachment(file: File) {
      console.log("adding attachment", file);
      this.attachments.push(file);
    },
    removeAttachment(file: File) {
      const index = this.attachments.indexOf(file);
      if (index != -1) {
        this.attachments.splice(index, 1);
      }
    },
    addEmoji() {
      // TODO
    },
  });

  function mimeIcon(mimeType: string): string {
    switch (mimeType.split("/")[0]) {
      case "image":
        return "image";
      case "video":
        return "movie";
      case "audio":
        return "audiotrack";
      case "application":
        return "widgets";
      default:
        return "attachment";
    }
  }

  function onInputKeyDown(event: KeyboardEvent) {
    console.log("textarea key down", event);
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sending.update((sending) => {
        sending.send();
        return sending;
      });
    }
  }

  let showInputMenu = false;
  let attachmentInput: HTMLInputElement;
</script>

<header>
  <button class="menu" on:click={onMenu} tabindex="0">
    <Symbol name="menu" />
  </button>
  {#if channel}
    <h3>
      {#if channel.type == discord.ChannelType.DirectMessage}
        <Icon url={discord.userAvatar($recipients[0])} name={discord.channelName(channel)} inline />
      {:else}
        <Icon symbol={channelIcon(channel)} name={discord.channelName(channel)} inline />
      {/if}
      {discord.channelName(channel, false)}
      {#if guild}
        <span class="guild">
          —
          <Icon url={discord.guildIcon($guild, false)} name={$guild.name} inline />
          <span class="name">{$guild.name}</span>
        </span>
      {/if}
    </h3>
  {/if}
</header>

{#if channel}
  {#await promise}
    <div class="loading">
      <Loading size={46} />
    </div>
  {:then}
    <div id="messages">
      {#each $messages as message, i}
        <Message {message} compact={shouldBeCompact($messages, i)} />
      {/each}
    </div>
  {/await}
{:else}
  <div class="placeholder">
    <Symbol name="question_answer" />
    <p>Select a channel to start chatting!</p>
  </div>
{/if}

<footer>
  {#if channel}
    <form id="message-input" on:submit|preventDefault={$sending.send}>
      <div id="file-list">
        {#if $sending.attachments.length > 0}
          <ul class="not">
            {#each $sending.attachments as attachment}
              <li class="file">
                <Symbol name={mimeIcon(attachment.type)} tooltip={attachment.type} />
                <span class="file-name">{attachment.name}</span>
                <small class="file-size">{prettyBytes(attachment.size)}</small>
                <button
                  type="button"
                  class="remove flat"
                  on:click={() => {
                    sending.update((sending) => {
                      sending.removeAttachment(attachment);
                      return sending;
                    });
                  }}
                  tabindex="0"
                >
                  <Symbol name="delete" tooltip="Delete attachment" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      <aside>
        <button
          type="button"
          id="show-menu"
          class="flat"
          class:active={showInputMenu}
          on:click={() => (showInputMenu = true)}
          tabindex="0"
        >
          <Symbol name="add" tooltip="Show input menu" />
        </button>
        <input
          type="file"
          bind:this={attachmentInput}
          on:change={() => {
            console.log("adding files", attachmentInput.files);
            if (attachmentInput.files) {
              const files = Array.from(attachmentInput.files);
              attachmentInput.files = null;

              sending.update((sending) => {
                files.forEach((file) => sending.addAttachment(file));
                return sending;
              });
            }
          }}
          style="display: none"
        />
        <MenuFrame id="more-menu" position="top" anchor="left" bind:open={showInputMenu}>
          <h5>Input Menu</h5>
          <ul class="not">
            <li>
              <button type="button" on:click={() => {}} tabindex="-1" disabled>
                <Symbol name="add_reaction" /> Emoji
              </button>
            </li>
            <li>
              <button
                type="button"
                on:click={() => {
                  showInputMenu = false;
                  attachmentInput.click();
                }}
                tabindex="-1"
              >
                <Symbol name="attach_file" /> File
              </button>
            </li>
          </ul>
        </MenuFrame>
      </aside>
      <textarea
        class:multiline={$sending.content.includes("\n")}
        placeholder="Message"
        bind:value={$sending.content}
        on:keydown={onInputKeyDown}
        disabled={!canSendMessage}
        tabindex="0"
      />
    </form>
  {/if}
</footer>

<style>
  header + * {
    flex: 1;
    box-shadow: 0 22px 18px -35px inset rgba(0, 0, 0, 0.85),
      0 -22px 18px -35px inset rgba(0, 0, 0, 0.85);
  }

  header {
    display: flex;
    align-items: center;
    background-color: var(--color-bg);
  }

  header h3 {
    font-size: 1em;
    margin: auto 0;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    line-height: 1.5;
  }

  .menu {
    color: var(--color-text);
    background-color: transparent;
    height: 100%;
    border: none;
    display: flex;
    align-items: center;
    padding: 0.25em;
    margin: 0 0.25em;
  }

  .menu:hover {
    background-color: var(--color-bg-2);
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* Svelte fucking sucks. They had a proposal to fix this and they made
	 it fucking garbage. Now we have to do this. */
  .placeholder > :global(*:first-child) {
    display: contents;
    font-size: 7em;
    margin: 0;
  }

  .placeholder p {
    padding: 0 1em;
    text-align: center;
  }

  #messages {
    display: flex;
    flex-direction: column-reverse;
    max-width: 800px;
    margin: auto;
    padding-bottom: clamp(0.5em, 3vh, 1em);
  }

  #message-input {
    display: grid;
    position: relative;
    grid-template-columns: minmax(0, auto) 1fr;
    grid-template-rows: auto auto;
    border-top: 1px solid var(--color-bg-alt);
    max-width: 800px;
    margin: auto;
  }

  #message-input > #file-list {
    grid-area: 1 / 1 / 2 / 3;
  }

  #message-input > aside {
    grid-area: 2 / 1 / 3 / 2;
  }

  #message-input > textarea {
    grid-area: 2 / 2 / 3 / 3;
  }

  #file-list ul {
    margin-top: 0.35em;
  }

  #file-list li {
    margin: 0;
    margin-right: 0.5em;
    margin-left: 3.5em;
    font-size: 0.95em;
  }

  #file-list li :global(.material-symbols-rounded) {
    vertical-align: text-bottom;
  }

  #file-list .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  #file-list li .remove {
    padding: 0.15em;
    float: right;
  }

  #file-list li .remove:hover {
    background-color: var(--color-del);
  }

  #message-input textarea {
    height: 2.15em;
    resize: none;
    margin: auto 0;
    padding: 0.45em 0;
    padding-right: 0.25em;
    border: none;
    border-radius: 0;
    background: none;
    scrollbar-width: thin;
  }

  #message-input textarea.multiline {
    height: 4.45em;
  }

  #message-input aside {
    width: 3.5em;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  #show-menu {
    cursor: pointer;
    display: flex;
    color: var(--color-text);

    padding: 0.1em;
    margin: clamp(0em, 5vw, 0.2em);
    border-radius: 6px;
  }

  #show-menu :global(.material-symbols-rounded) {
    /* Symbol */
    font-size: clamp(1.5em, 10vw, 2em);
  }

  #show-menu:hover {
    background-color: var(--color-bg-2);
  }

  #show-menu.active {
    background-color: var(--color-bg-alt);
  }

  :global(#more-menu) {
    --padding: 0.25em;

    background-color: var(--color-bg-alt);
    padding: 0.25em;
    border-radius: 6px;
    margin: 0em 0.65em;
    width: 100%;
    max-width: clamp(80px, 25vw, 200px);
    box-sizing: border-box;
    z-index: 1;
  }

  :global(#more-menu) h5 {
    margin: calc(var(--padding) * 1.5) 0.15em;
    margin-top: var(--padding);
    font-size: 1em;
    font-weight: 600;
  }

  :global(#more-menu) ul {
    display: flex;
    flex-direction: column;
    gap: calc(var(--padding) * 1.5);
  }

  :global(#more-menu) li {
    margin: 0;
  }

  :global(#more-menu) li > button {
    width: 100%;
    text-align: left;
    vertical-align: middle;
    padding: var(--padding);
  }

  :global(#more-menu) li > button > :global(.material-symbols-rounded) {
    vertical-align: text-bottom;
  }

  footer {
    position: sticky;
    bottom: 0;
    background-color: var(--color-bg);
  }

  @media (max-width: 250px) {
    header h3 .guild {
      display: none;
    }

    #message-input aside {
      /* No more avatar to vertically align to. */
      width: auto;
    }

    #file-list ul {
      margin-top: 0.25em;
    }

    #file-list li {
      margin: 0 0.5em;
      font-size: 0.95em;
    }

    #file-list li .remove {
      padding: 0.15em;
      margin: 0;
      float: right;
    }

    #file-list li > :global(.material-symbols-rounded) {
      display: none;
    }

    :global(#more-menu) {
      --padding: 0.1em;
      margin: -0.15em 0.15em;
    }
  }

  @media (min-width: 451px) {
    header .menu {
      display: none;
    }

    header h3 {
      margin-left: 0.5em;
    }
  }
</style>
