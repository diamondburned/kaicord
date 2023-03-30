import * as fuzzy from "fast-fuzzy";
import * as store from "svelte/store";
import * as state from "#/lib/discord/state.js";
import * as discord from "#/lib/discord/discord.js";

type channelItem = {
  channel: discord.Channel;
  string: string;
};

type channelSearcher = {
  searcher: fuzzy.Searcher<channelItem, fuzzy.FullOptions<channelItem>>;
  timeoutHandle: number;
};

export class ChannelSearcher {
  private searcher?: channelSearcher;

  constructor(
    public readonly state: store.Writable<discord.State>,
    // threshold is the minimum score a fuzzy match must have to be included in
    // the results.
    public readonly threshold = 0.6,
    // limit is the maximum number of results to return.
    public readonly limit = 35
  ) {}

  search(input: string): discord.Channel[] {
    if (!input) {
      return [];
    }

    const searcher = this.buildSearcher();
    return searcher
      .search(input)
      .slice(0, this.limit)
      .map((item) => item.channel);
  }

  prepare() {
    this.buildSearcher();
  }

  private static fuzzyChannelItem(channel: discord.Channel, guild?: discord.Guild): channelItem {
    switch (channel.type) {
      case discord.ChannelType.DirectMessage:
      case discord.ChannelType.GroupDM: {
        const recipients = store.get(channel.recipients);
        return {
          channel,
          string: (channel.name ?? "") + " " + recipients.map((u) => u.username).join(" "),
        };
      }
      default: {
        if (!guild) guild = store.get(channel.guild);
        return {
          channel,
          string: `${guild.name} ${channel.name}`,
        };
      }
    }
  }

  private buildSearcher(): channelSearcher["searcher"] {
    if (this.searcher) {
      clearInterval(this.searcher.timeoutHandle);
    } else {
      const state = store.get(this.state);
      const channels: channelItem[] = [];

      for (const [_, guild] of state.guilds) {
        for (const [_, channel] of guild.channels) {
          switch (channel.type) {
            case discord.ChannelType.DirectMessage:
            case discord.ChannelType.GroupDM:
              continue;
          }

          if (!discord.TextChannelTypes.has(channel.type)) {
            continue;
          }

          channels.push(ChannelSearcher.fuzzyChannelItem(channel, guild));
          if (channel.threads) {
            for (const [_, thread] of channel.threads) {
              channels.push(ChannelSearcher.fuzzyChannelItem(thread, guild));
            }
          }
        }
      }

      for (const [_, channel] of state.privateChannels) {
        if (!discord.TextChannelTypes.has(channel.type)) {
          continue;
        }
        channels.push(ChannelSearcher.fuzzyChannelItem(channel));
      }

      const searcher = new fuzzy.Searcher(channels, {
        keySelector: (item) => item.string,
        threshold: this.threshold,
      });

      this.searcher = {
        searcher,
        timeoutHandle: 0,
      };
    }

    this.searcher.timeoutHandle = window.setInterval(() => (this.searcher = undefined), 30 * 1000);
    return this.searcher.searcher;
  }
}
