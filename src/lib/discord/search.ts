import * as fuzzy from "fuzzy";
import * as store from "svelte/store";
import * as state from "#/lib/discord/state.js";
import * as discord from "#/lib/discord/discord.js";

export class ChannelSearcher {
  constructor(
    public readonly state: store.Writable<state.StateData>,
    // threshold is the minimum score a fuzzy match must have to be included in
    // the results.
    public readonly threshold = 0.05,
    // limit is the maximum number of results to return.
    public readonly limit = 35
  ) {}

  search(input: string): discord.Channel[] {
    if (!input) {
      return [];
    }

    // TODO: implement dynamic searching: if previous input is a suffix of the
    // current input, only search the channels that were previously returned.

    const state = store.get(this.state);
    const matches: (discord.Channel & { _score: number })[] = [];

    const addMatch = (channel: discord.Channel, result: fuzzy.MatchResult) => {
      // if (score < this.threshold) {
      //   return;
      // }

      if (matches.length < this.limit) {
        console.debug(
          "search: adding match",
          result.rendered,
          result.score,
          "since matches.length < this.limit"
        );
        matches.push({ ...channel, _score: result.score });
        return;
      }

      // Jesus fuck, Copilot. I'm so glad I didn't have to write this.
      const worst = matches.reduce(
        (worst, match) => (match._score < worst._score ? match : worst),
        matches[0]
      );
      if (result.score > worst._score) {
        console.debug(
          "search: adding match",
          result.rendered,
          result.score,
          "since score > worst._score"
        );
        matches[matches.indexOf(worst)] = { ...channel, _score: result.score };
      }

      console.debug(
        "search: not adding match",
        result.rendered,
        result.score,
        "since score <= worst._score"
      );
    };

    for (const [_, guild] of state.guilds) {
      for (const [_, channel] of guild.channels) {
        if (!discord.TextChannelTypes.has(channel.type)) {
          continue;
        }

        const match = fuzzy.match(input, `${guild.name} ${channel.name}`);
        if (match) {
          addMatch(channel, match);
        }
      }
    }

    for (const [_, channel] of state.privateChannels) {
      if (!discord.TextChannelTypes.has(channel.type)) {
        continue;
      }

      let name = channel.name ?? "";
      switch (channel.type) {
        case discord.ChannelType.DirectMessage:
        case discord.ChannelType.GroupDM:
          name += " " + channel.recipients.map((u) => u.username).join(" ");
      }

      const match = fuzzy.match(input, name);
      if (match) {
        addMatch(channel, match);
      }
    }

    matches.sort((a, b) => b._score - a._score);
    return matches;
  }
}
