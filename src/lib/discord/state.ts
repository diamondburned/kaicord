import * as gateway from "#/lib/discord/gateway.js";
import * as discord from "#/lib/discord/discord.js";
import * as api from "#/lib/discord/api.js";
import * as store from "svelte/store";
import * as persistent from "#/lib/persistent.js";

type StateStore = store.Readable<discord.State>;

function stateChannel(state: discord.State, id: string): discord.Channel | null {
  for (const [_, guild] of state.guilds) {
    const channel = guild.channels.get(id);
    if (channel) return channel;
  }

  const channel = state.privateChannels.get(id);
  if (channel) return channel;

  return null;
}

function unwrap<T>(v: T | null | undefined): T {
  if (v == undefined || v == null) {
    throw new Error("assertion failed: value is null or undefined");
  }
  return v!;
}

export function convertUser(user: api.User): discord.Friend {
  return {
    ...user,
    bot: !!user.bot,
  };
}

export function convertMember(
  state: StateStore,
  guildID: discord.ID,
  member: api.Member
): discord.Member {
  return {
    ...convertUser(member.user),
    guild: store.derived(state, (state) => unwrap(state.guilds.get(guildID))),
    roles: store.derived(state, (state) => {
      const knownRoles = unwrap(state.guilds.get(guildID)).roles;
      const roles = member.roles
        .map((roleID) => unwrap(knownRoles.find((known) => known.id == roleID)))
        .filter((role) => role);
      return roles;
    }),
    nick: member.nick,
  };
}

export function convertGuildChannel(
  state: StateStore,
  channel: api.Channel,
  guildID: string
): Extract<discord.Channel, { type: Exclude<discord.ChannelType, discord.ChannelDMTypes> }> | null {
  switch (channel.type) {
    case discord.ChannelType.DirectMessage:
    case discord.ChannelType.GroupDM: {
      console.debug("cannot convert guild channel (invalid type)", channel);
      return null;
    }
    default: {
      return {
        id: channel.id,
        type: channel.type,
        nsfw: channel.nsfw,
        name: channel.name,
        topic: channel.topic,
        guild: store.derived(state, (state) => unwrap(state.guilds.get(guildID))),
        position: channel.position ?? 0,
      };
    }
  }
}

export function convertPrivateChannel(
  state: StateStore,
  channel: api.Channel
): discord.Channel | null {
  let recipientIDs = channel.recipient_ids;
  if (!recipientIDs && channel.recipients) {
    recipientIDs = channel.recipients.map((user) => user.id);
  }
  if (!recipientIDs) {
    recipientIDs = [];
  }

  switch (channel.type) {
    case discord.ChannelType.DirectMessage:
    case discord.ChannelType.GroupDM: {
      return {
        id: channel.id,
        type: channel.type,
        name: channel.name,
        topic: channel.topic,
        recipients: store.derived(state, (state) => {
          return recipientIDs!.map((id) => unwrap(state.friends.get(id)));
        }),
      };
    }
    default: {
      console.debug("cannot convert private channel (invalid type)", channel);
      return null;
    }
  }
}

export function convertAttachment(
  attachment: NonNullable<api.Message["attachments"]>[number]
): discord.Attachment {
  return {
    ...attachment,
    type: attachment.content_type,
    proxyURL: attachment.proxy_url,
  };
}

export function convertEmbed(embed: NonNullable<api.Message["embeds"]>[number]): discord.Embed {
  function convertObject<T extends any>(obj: Record<string, any>): T {
    const dst = { ...obj };
    for (const [k, v] of Object.entries(obj)) {
      switch (k) {
        case "icon_url":
          dst["iconURL"] = v;
          break;
        case "proxy_url":
          dst["proxyURL"] = v;
          break;
        case "proxy_icon_url":
          dst["proxyIconURL"] = v;
          break;
      }
    }
    return dst as T;
  }

  return {
    ...embed,
    type: embed.type as discord.Embed["type"],
    footer: embed.footer ? convertObject(embed.footer) : undefined,
    image: embed.image ? convertObject(embed.image) : undefined,
    thumbnail: embed.thumbnail ? convertObject(embed.thumbnail) : undefined,
    video: embed.video ? convertObject(embed.video) : undefined,
    provider: embed.provider ? convertObject(embed.provider) : undefined,
    author: embed.author ? convertObject(embed.author) : undefined,
    fields: embed.fields ? embed.fields.map((field) => convertObject(field)) : undefined,
  };
}

export function convertTimestamp(timestamp: string): Date {
  return new Date(Date.parse(timestamp));
}

export function convertChannelMessage(state: StateStore, message: api.Message): discord.Message {
  const stateStore = state;
  const v = {
    id: message.id,
    type: message.type,
    content: message.content,
    channel: store.derived(state, (state) => unwrap(stateChannel(state, message.channel_id))),
    timestamp: convertTimestamp(message.timestamp),
    editedTimestamp: message.edited_timestamp
      ? convertTimestamp(message.edited_timestamp)
      : undefined,
    attachments: (message.attachments ?? []).map(convertAttachment),
    embeds: (message.embeds ?? []).map(convertEmbed),
    reference: message.referenced_message
      ? // I wonder if this could cause a stack overflow by having cyclic
        // message references.
        convertChannelMessage(state, message.referenced_message)
      : message.message_reference
      ? {
          id: message.message_reference.message_id as discord.ID,
          guildID: message.message_reference.guild_id as discord.ID,
          channelID: message.message_reference.channel_id as discord.ID,
        }
      : undefined,
  };

  const channel = unwrap(stateChannel(store.get(state), message.channel_id));
  switch (channel.type) {
    case discord.ChannelType.DirectMessage:
    case discord.ChannelType.GroupDM: {
      return {
        ...v,
        guild: undefined,
        author: store.derived(state, (state) => {
          const user = state.friends.get(message.author.id);
          if (user) {
            return user;
          }
          return convertUser(message.author);
        }),
      };
    }
    default: {
      const guildID = store.get(channel.guild).id;
      return {
        ...v,
        guild: store.derived(state, (state) => unwrap(state.guilds.get(message.guild_id!))),
        author: store.derived(state, (state) => {
          const guild = unwrap(state.guilds.get(unwrap(guildID)));
          const member = guild.members.get(message.author.id);
          if (member) {
            return member;
          }

          return {
            ...convertUser(message.author),
            guild: store.derived(stateStore, (state) => unwrap(state.guilds.get(guildID))),
            roles: store.readable(undefined),
          };
        }),
      };
    }
  }
}

function convertGuildCreate(state: StateStore, guild: gateway.GuildCreateData): discord.Guild {
  const g: discord.Guild = {
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    roles: guild.roles.sort((a, b) => a.position - b.position),
    members: new Map(),
    channels: new Map(),
  };

  for (const member of guild.members ?? []) {
    g.members.set(member.user.id, convertMember(state, g.id, member));
  }

  for (const channel of guild.channels ?? []) {
    const ch = convertGuildChannel(state, channel, guild.id);
    if (ch) {
      g.channels.set(ch.id, ch);

      if (guild.threads) {
        ch.threads = new Map();
        guild.threads
          .filter((thread) => thread.parent_id === ch.id)
          .map((thread) => unwrap(convertGuildChannel(state, thread, guild.id)))
          .forEach((thread) => g.channels.set(thread.id, thread));
      }
    }
  }

  return g;
}

export class State extends gateway.Session implements StateStore {
  public readonly state = store.writable(State.reset());
  public readonly chMessages = new Map<discord.ID, store.Writable<discord.Message[]>>();
  public readonly self = store.writable<discord.Friend>();

  private subscribedGuilds = new Set<discord.ID>();

  constructor(
    public readonly client: api.Client,
    public readonly opts = {
      messageLimit: 100,
      key: "gw_state",
    }
  ) {
    super(client, opts.key);
    this.event.subscribe((ev) => {
      try {
        this.state.update((state) => {
          if (ev && ev.op == 0) {
            console.debug("state: updating with event", ev);
            state = this.updateState(state, ev);
            this.updateMessages(state, this.chMessages, ev);
          }
          return state;
        });
      } catch (err) {
        console.debug("state error:", err);
      }
    });
  }

  subscribe(
    run: (value: discord.State) => void,
    invalidate?: (value?: discord.State) => void
  ): store.Unsubscriber {
    return this.state.subscribe(run, invalidate);
  }

  channel(id: discord.ID): store.Readable<discord.Channel | null> {
    return store.derived(this.state, (state) => stateChannel(state, id));
  }

  // user gets the user with the given ID. If no user ID is given, the current
  // user is returned.
  user(guildID: discord.ID | null, userID: discord.ID): store.Readable<discord.User | null> {
    const self = store.get(this.self);
    if (guildID == null && self.id == userID) {
      return this.self;
    }
    return store.derived(this.state, (state) => {
      if (guildID) {
        const guild = unwrap(state.guilds.get(unwrap(guildID)));
        return guild.members.get(userID) ?? null;
      } else {
        return state.friends.get(userID) ?? null;
      }
    });
  }

  async messages(id: discord.ID): Promise<store.Writable<discord.Message[]>> {
    let list = this.chMessages.get(id);
    if (list) return list;

    const channelStore = this.channel(id);
    const channel = store.get(channelStore);
    if (!channel) {
      // weird, we requested messages from a channel we don't know about
      throw new Error(`unknown channel with ID ${id}`);
    }

    const messages = await this.client.do<api.FetchMessage>({
      method: "GET",
      path: `/channels/${id}/messages`,
      limit: Math.min(100, this.opts.messageLimit),
    });

    list = store.writable<discord.Message[]>(
      messages.map((message) => convertChannelMessage(this.state, message))
    );

    this.chMessages.set(id, list);

    switch (channel.type) {
      case discord.ChannelType.DirectMessage:
      case discord.ChannelType.GroupDM: {
        break;
      }
      default: {
        const guild = store.get(channel.guild);

        if (!this.subscribedGuilds.has(guild.id)) {
          // Send this so we can have a list of threads later on.
          this.send({
            op: 14,
            d: {
              guild_id: guild.id,
              typing: true,
              threads: true,
              activities: false,
            },
          });
          this.subscribedGuilds.add(guild.id);
        }

        // We'll also request all the members of the messages that we just
        // fetched.
        const memberIDs = new Set<discord.ID>();
        for (const message of messages) {
          if (!guild.members.has(message.author.id)) {
            memberIDs.add(message.author.id);
          }
        }

        if (memberIDs.size > 0) {
          this.send({
            op: 8,
            d: {
              guild_id: guild.id,
              user_ids: Array.from(memberIDs),
              presences: false,
            },
          });
        }
      }
    }

    return list;
  }

  private updateState(state: discord.State, ev: gateway.DispatchEvent): discord.State {
    switch (ev.t) {
      case "READY": {
        this.self.set(convertUser(ev.d.user));
        state = State.reset();

        for (const friend of ev.d.users) {
          state.friends.set(friend.id, convertUser(friend));
        }

        for (const guild of ev.d.guilds) {
          state.guilds.set(guild.id, convertGuildCreate(this.state, guild));
        }

        for (const dm of ev.d.private_channels) {
          const ch = convertPrivateChannel(this.state, dm);
          if (ch) {
            state.privateChannels.set(ch.id, ch);
          }
        }
        break;
      }

      case "GUILD_CREATE": {
        const guild = convertGuildCreate(this.state, ev.d);
        state.guilds.set(guild.id, guild);
        break;
      }

      case "GUILD_UPDATE": {
        // TODO: give a fuck
        break;
      }

      case "GUILD_DELETE": {
        state.guilds.delete(ev.d.id);
        break;
      }

      case "GUILD_MEMBERS_CHUNK": {
        const guild = state.guilds.get(ev.d.guild_id);
        if (guild) {
          for (const member of ev.d.members) {
            guild.members.set(member.user.id, convertMember(this.state, guild.id, member));
          }
        }
        break;
      }

      case "CHANNEL_CREATE": {
        const channel = ev.d;
        if (channel.guild_id) {
          const guild = state.guilds.get(channel.guild_id);
          if (guild) {
            const ch = convertGuildChannel(this.state, channel, guild.id);
            if (ch) {
              guild.channels.set(ch.id, ch);
            }
          }
        } else {
          const ch = convertPrivateChannel(this.state, channel);
          if (ch) {
            state.privateChannels.set(ch.id, ch);
          }
        }
        break;
      }

      case "CHANNEL_UPDATE": {
        // TODO: give a fuck
        break;
      }

      case "CHANNEL_DELETE": {
        const channel = ev.d;
        switch (channel.type) {
          case discord.ChannelType.DirectMessage:
          case discord.ChannelType.GroupDM:
            state.privateChannels.delete(channel.id);
          default:
            if (channel.guild_id) {
              const guild = state.guilds.get(channel.guild_id);
              if (guild) {
                guild.channels.delete(channel.id);
              }
            }
        }
        break;
      }

      // TODO: handle more than just thread syncs. We can just tell the user to
      // reload for now :)
      case "THREAD_LIST_SYNC": {
        let channelIDs = ev.d.channel_ids ?? [];
        if (channelIDs.length == 0) {
          const guild = state.guilds.get(ev.d.guild_id);
          if (!guild) {
            break;
          }
          for (const [chID] of guild.channels) {
            channelIDs.push(chID);
          }
        }

        let channelThreads = new Map<discord.ID, discord.Channel[]>();
        for (const chID of channelIDs) {
          const threads = ev.d.threads.filter((thread) => thread.parent_id == chID);
          channelThreads.set(
            chID,
            threads.map((thread) => unwrap(convertGuildChannel(this.state, thread, ev.d.guild_id)))
          );
        }

        break;
      }
    }

    return state;
  }

  private updateMessages(
    state: discord.State,
    lists: Map<discord.ID, store.Writable<discord.Message[]>>,
    ev: gateway.Event
  ) {
    if (!ev || ev.op != 0) return;

    switch (ev.t) {
      case "MESSAGE_CREATE":
      case "MESSAGE_UPDATE":
      case "MESSAGE_DELETE": {
        const channel = this.messageChannel(state, ev.d);
        if (!channel) {
          console.debug("message_create: channel not found", ev.d);
          return state;
        }

        let messages = lists.get(channel.id);
        if (!messages) {
          // channel never fetched, ignore
          return state;
        }

        messages.update((messages) => {
          switch (ev.t) {
            case "MESSAGE_CREATE": {
              if (ev.d.guild_id && ev.d.member) {
                // Load this member into our state.
                const guild = state.guilds.get(ev.d.guild_id);
                if (guild) {
                  // Discord is lazy and doesn't attach the user field in the
                  // member object. We'll add it ourselves.
                  guild.members.set(
                    ev.d.author.id,
                    convertMember(this.state, guild.id, {
                      ...ev.d.member,
                      user: ev.d.author,
                    })
                  );
                }
              }

              messages.unshift(convertChannelMessage(this.state, ev.d));
              if (messages.length > this.opts.messageLimit) {
                messages.pop();
              }

              break;
            }

            case "MESSAGE_UPDATE": {
              const message = messages.find((m) => m.id == ev.d.id);
              if (message) {
                if (ev.d.content) message.content = ev.d.content;
                if (ev.d.attachments) message.attachments = ev.d.attachments.map(convertAttachment);
                if (ev.d.edited_timestamp)
                  message.editedTimestamp = convertTimestamp(ev.d.edited_timestamp);
                // TODO: embeds
              }

              break;
            }

            case "MESSAGE_DELETE": {
              const message = messages.find((m) => m.id == ev.d.id);
              if (message) {
                messages.splice(messages.indexOf(message), 1);
              }

              break;
            }
          }

          return messages;
        });

        break;
      }
    }
  }

  private messageChannel(
    state: discord.State,
    message: Pick<api.Message, "guild_id"> & Pick<api.Message, "channel_id">
  ): discord.Channel | null {
    let channel: discord.Channel | undefined;
    if (message.guild_id) {
      const guild = state.guilds.get(message.guild_id);
      if (!guild) {
        console.debug("message_create: guild not found", message);
        return null;
      }

      channel = guild.channels.get(message.channel_id);
    } else {
      channel = state.privateChannels.get(message.channel_id);
    }

    return channel ?? null;
  }

  private static reset(): discord.State {
    return {
      guilds: new Map(),
      friends: new Map(),
      privateChannels: new Map(),
    };
  }
}
