import * as store from "svelte/store";
import { Pointer } from "#/lib/storeutil.js";

export type ID = string; // snowflake

export type Timestamp = `${number}-${number}-${number}T${number}:${number}:${number}${string}`;

export type State = {
  guilds: Map<ID, Guild>;
  friends: Map<ID, User>;
  privateChannels: Map<ID, Channel>;
};

export type Guild = {
  id: ID;
  name: string;
  icon?: string;
  roles: GuildRole[];
  members: Map<ID, GuildMember>;
  channels: Map<ID, Channel>;
};

export type User = {
  id: ID;
  username: string;
  discriminator: string;
  avatar?: string;
  bot: boolean;
};

// ChannelDMTypes are the types of channels that are direct messages.
export type ChannelDMTypes = ChannelType.DirectMessage | ChannelType.GroupDM;

export type Channel = {
  id: ID;
  name?: string;
  topic?: string;
} & (
  | {
      type: Exclude<ChannelType, ChannelDMTypes>;
      nsfw?: boolean;
      guild: store.Readable<Guild>;
      position: number;
    }
  | {
      type: ChannelDMTypes;
      recipients: store.Readable<User[]>;
    }
);

export enum ChannelType {
  GuildText,
  DirectMessage,
  GuildVoice,
  GroupDM,
  GuildCategory,
  GuildNews,
  GuildStore,
  __unused1__,
  __unused2__,
  __unused3__,
  GuildNewsThread,
  GuildPublicThread,
  GuildPrivateThread,
  GuildStageVoice,
  GuildDirectory,
  GuildForum,
}

export const TextChannelTypes = new Set([
  ChannelType.DirectMessage,
  ChannelType.GroupDM,
  ChannelType.GuildText,
  ChannelType.GuildNews,
  ChannelType.GuildStore,
  ChannelType.GuildNewsThread,
  ChannelType.GuildPublicThread,
  ChannelType.GuildPrivateThread,
  ChannelType.GuildVoice, // this has a text channel
]);

export type Message = {
  id: ID;
  type: MessageType;
  channel: store.Readable<Channel>;
  author: store.Readable<User & { member?: GuildMember }>;
  guild?: store.Readable<Guild>;
  content: string;
  timestamp: Date;
  editedTimestamp?: Date;
  attachments: {
    id: ID;
    filename: string;
    size: number;
    url: string;
    proxyURL: string;
  }[];
  reference?:
    | Message
    | {
        id: ID;
        channelID: ID;
        guildID?: ID;
      };
};

export enum MessageType {
  DefaultMessage,
  RecipientAddMessage,
  RecipientRemoveMessage,
  CallMessage,
  ChannelNameChangeMessage,
  ChannelIconChangeMessage,
  ChannelPinnedMessage,
  GuildMemberJoinMessage,
  NitroBoostMessage,
  NitroTier1Message,
  NitroTier2Message,
  NitroTier3Message,
  ChannelFollowAddMessage,
  __unused1__,
  GuildDiscoveryDisqualifiedMessage,
  GuildDiscoveryRequalifiedMessage,
  GuildDiscoveryGracePeriodInitialWarning,
  GuildDiscoveryGracePeriodFinalWarning,
  ThreadCreatedMessage,
  InlinedReplyMessage,
  ChatInputCommandMessage,
  ThreadStarterMessage,
  GuildInviteReminderMessage,
  ContextMenuCommand,
  AutoModerationActionMessage,
}

export type GuildMember = User & {
  guild: store.Readable<Guild>;
  roles: store.Readable<GuildRole[]>;
};

export type GuildRole = {
  id: ID;
  name: string;
  color: number;
  position: number;
};

export function iconURL(id: ID, iconHash: string, format = ".png"): string {
  if (format == ".gif" && !iconHash.startsWith("a_")) {
    format = ".png";
  }
  return `https://cdn.discordapp.com/icons/${id}/${iconHash}${format}`;
}

export function guildIcon(guild: Guild, animated: boolean): string {
  if (guild.icon) {
    return iconURL(guild.id, guild.icon, animated ? ".gif" : ".png");
  }
  return "";
}

// userAvatar is a function that takes a User and returns a string
// that is the URL of the user's avatar.
export function userAvatar(user: User): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
  }

  const discriminator = parseInt(user.discriminator, 10);
  const picNo = discriminator % 5;
  return `https://cdn.discordapp.com/embed/avatars/${picNo}.png`;
}

export function channelName(channel: Channel, hash = true): string {
  switch (channel.type) {
    case ChannelType.DirectMessage:
    case ChannelType.GroupDM:
      if (channel.name) {
        return channel.name;
      }

      const names = store
        .get(channel.recipients)
        .map((user) => user.username)
        .filter((name) => name)
        .join(", ");

      if (names.length > 0) {
        return names;
      }

      return "Unknown DM";

    case ChannelType.GuildCategory:
      return (hash ? ">" : "") + channel.name ?? "";

    default:
      return (hash ? "#" : "") + channel.name ?? "";
  }
}

export function hexColor(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}
