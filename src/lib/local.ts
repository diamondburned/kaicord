import * as persistent from "#/lib/persistent.js";
import * as discord from "#/lib/discord/discord.js";
import * as gateway from "#/lib/discord/gateway.js";
import * as api from "#/lib/discord/api.js";
import * as store from "svelte/store";
import { State } from "#/lib/discord/state.js";

// RecentChannel is a type that tracks how many times a channel has been
// selected.
export type RecentChannel = {
  id: string;
  time: number;
  uses: number;
};

export const recentChannels = persistent.writable<RecentChannel[]>("channels", []);

// connected is true if session is valid.
export const connected = store.writable(false);

// session is the singleton state instance.
export const session = store.writable<State>();
export const state = session;

export const client = api.Client.default();

// open opens a connection to the Discord gateway. It does nothing if a
// connection is already open.
export async function open(token?: string): Promise<void> {
  const s = new State(client);

  const ok = await s.open(token);
  if (!ok) {
    throw new Error("invalid token");
  }

  connected.set(true);
  session.set(s);
}

export default session;
