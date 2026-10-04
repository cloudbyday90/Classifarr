/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Client } from 'discord.js';
import { createDiscordRestTransport } from './discordRestTransport.mjs';

const lifetimes = new WeakMap();
export const discordClientSignal = client => lifetimes.get(client);

/** @param {import('discord.js').ClientOptions} options */
export function createDiscordClient(options, transportOptions = {}) {
  const transport = createDiscordRestTransport(transportOptions);
  const client = new Client({
    ...options,
    rest: { ...options.rest, timeout: transport.timeout, makeRequest: transport.makeRequest },
  });
  const lifetime = new AbortController();
  lifetimes.set(client, lifetime.signal);
  const destroy = client.destroy.bind(client);
  client.destroy = async () => {
    lifetime.abort();
    transport.close();
    await destroy();
  };
  return client;
}
