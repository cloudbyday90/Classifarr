/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Client } from 'discord.js';
import { createDiscordRestTransport } from './discordRestTransport.mjs';
import { bindDiscordSdkRequestBudget } from './discordSdkRequestBudget.mjs';
import { DiscordRestError } from './discordRestResponse.mjs';

const lifetimes = new WeakMap();
export const discordClientSignal = client => lifetimes.get(client);

/** @param {import('discord.js').ClientOptions} options */
export function createDiscordClient(options, transportOptions = {}, gate = null) {
  const transport = createDiscordRestTransport(transportOptions);
  const makeRequest = async (url, init) => {
    // Interaction/webhook tokens are not subject to the bot global cooldown.
    const bot = new Headers(init.headers).get('authorization')?.startsWith('Bot ');
    if (bot) {
      const response = await gate.run(transport.makeRequest, url, init);
      // The gate owns bot bucket waits. The SDK creates a sleep timer BEFORE its
      // rejection hook; do not let it schedule a second wait from these headers.
      const headers = new Headers(response.headers);
      headers.delete('x-ratelimit-remaining');
      headers.delete('x-ratelimit-reset-after');
      return { ...response, headers };
    }
    const response = await transport.makeRequest(url, init);
    if (response.status === 429) throw new DiscordRestError('DISCORD_REST_RATE_LIMITED', 'Discord request rate limited');
    return response;
  };
  const client = new Client({
    ...options,
    rest: { ...options.rest, timeout: transport.timeout,
      makeRequest: gate ? makeRequest : transport.makeRequest,
      ...gate ? { rejectOnRateLimit: async data => {
        if (data.route.startsWith('/interactions/') || data.route.startsWith('/webhooks/')) {
          throw new DiscordRestError('DISCORD_REST_RATE_LIMITED', 'Discord request rate limited');
        }
        return gate.defer(data.retryAfter / 1000);
      } } : {},
    },
  });
  const lifetime = new AbortController();
  lifetimes.set(client, lifetime.signal);
  if (gate) bindDiscordSdkRequestBudget(client.rest, lifetime.signal, { timeoutMs: transportOptions.timeoutMs ?? 15000 });
  const destroy = client.destroy.bind(client);
  client.destroy = async () => {
    lifetime.abort();
    transport.close();
    await destroy();
  };
  return client;
}
