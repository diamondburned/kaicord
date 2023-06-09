import * as store from "svelte/store";
import { Pointer } from "#/lib/storeutil.js";

export type ID = string; // snowflake

export type Timestamp = `${number}-${number}-${number}T${number}:${number}:${number}${string}`;

export type State = {
  guilds: Map<ID, Guild>;
  friends: Map<ID, Friend>;
  privateChannels: Map<ID, Channel>;
};

export type Guild = {
  id: ID;
  name: string;
  icon?: string;
  roles: GuildRole[];
  members: Map<ID, Member>;
  channels: Map<ID, Channel>;
};

// User describes a user that belongs in either a guild or a private channel.
export type User = {
  id: ID;
  username: string;
  discriminator: string;
  avatar?: string;
  bot: boolean;
} & (
  | {
      // Private channel.
      guild?: undefined;
    }
  | {
      // Guild.
      guild: store.Readable<Guild>;
      roles: store.Readable<GuildRole[] | undefined>; // undefined if not loaded yet
      nick?: string;
    }
);

export type Friend = Extract<User, { guild?: undefined }>;
export type Member = Extract<User, { guild: store.Readable<Guild> }>;

// stripUser returns the User as a User object without the guild field. This is
// useful for comparing users without caring about their guild.
export function stripUser(u: User | store.Readable<User>): Friend {
  if ((u as any).subscribe) {
    u = store.get(u as any);
  }
  return u as Friend;
}

// ChannelDMTypes are the types of channels that are direct messages.
export type ChannelDMTypes = ChannelType.DirectMessage | ChannelType.GroupDM;

// ChannelThreadTypes are the types of channels that are threads.
export type ChannelThreadTypes =
  | ChannelType.GuildPublicThread
  | ChannelType.GuildPrivateThread
  | ChannelType.GuildNewsThread;

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
      threads?: Map<ID, Channel>;
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
  content: string;
  timestamp: Date;
  editedTimestamp?: Date;
  webhookID?: ID;
  attachments: Attachment[];
  embeds: Embed[];
  reference?:
    | Message
    | {
        id: ID;
        channelID: ID;
        guildID?: ID;
      };
} & (
  | {
      author: store.Readable<Friend>;
      guild?: undefined;
    }
  | {
      author: store.Readable<Member>;
      guild: store.Readable<Guild>;
    }
);

export type Attachment = {
  id: ID;
  filename: string;
  description?: string;
  type?: string;
  size: number;
  url: string;
  proxyURL: string;
  width?: number;
  height?: number;
};

export type Embed = Partial<{
  title: string;
  type: "rich" | "image" | "video" | "gifv" | "article" | "link";
  description: string;
  url: string;
  timestamp: string;
  color: number;
  footer: {
    text: string;
    iconURL?: string;
    proxyIconURL?: string;
  };
  image: {
    url: string;
    proxyURL: string;
    height?: number;
    width?: number;
  };
  thumbnail: {
    url?: string;
    proxyURL?: string;
    height?: number;
    width?: number;
  };
  video: {
    url: string;
    proxyURL?: string;
    height: number;
    width: number;
  };
  provider: {
    name: string;
    url: string;
  };
  author: {
    name?: string;
    url?: string;
    iconURL?: string;
    proxyIconURL?: string;
  };
  fields: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}>;

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

      const recipients = store.get(channel.recipients);
      if (recipients.length == 1) {
        return `${recipients[0].username}#${recipients[0].discriminator}`;
      }

      const names = recipients
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

export function rolesColor(roles: GuildRole[], { rgb }: { rgb: boolean } = { rgb: false }): string {
  roles.sort((a, b) => b.position - a.position);
  const role = roles.find((role) => role.color !== 0);
  if (!role) {
    return "";
  }

  if (rgb) {
    const r = (role.color >> 16) & 0xff;
    const g = (role.color >> 8) & 0xff;
    const b = role.color & 0xff;
    return `rgb(${r}, ${g}, ${b})`;
  }

  return `#${role.color.toString(16).padStart(6, "0")}`;
}
