/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DefaultRestOptions, DefaultUserAgent, MessagePayload } from 'discord.js';
import { createDiscordRestTransport } from './discordRestTransport.mjs';
import { createDiscordProviderGate } from './discordProviderGate.mjs';
import { discordClientSignal } from './discordClientFactory.mjs';

/** Single POST; no SDK queue, automatic retries, attachment fetches or redirects. */
export function createDiscordDeliveryWriter({ cooldown = null, gate = createDiscordProviderGate({ cooldown }), request = fetch, timeoutMs = 15000 }) {
  return async (input, payload) => {
    const signals = [input.signal, discordClientSignal(input.client)].filter(Boolean);
    const signal = signals.length ? AbortSignal.any(signals) : undefined;
    // These notifications use remote embed images, never uploaded attachments.
    if (payload.files?.length || payload.attachments?.length) throw new Error('unsupported_delivery_files');
    const body = JSON.stringify(MessagePayload.create(input.channel, payload).resolveBody().body);
    if (Buffer.byteLength(body) > 256 * 1024) throw new Error('delivery_payload_too_large');
    signal?.throwIfAborted();
    const transport = createDiscordRestTransport({
      request: (url, init) => request(url, { method: init.method, body: init.body,
        signal: init.signal, redirect: 'error', headers: /** @type {Record<string, string>} */ (init.headers) }),
      timeoutMs, maxBytes: 256 * 1024, maxConcurrent: 1,
    });
    try {
      const response = await gate.run(transport.makeRequest,
        `${DefaultRestOptions.api}/v${DefaultRestOptions.version}/channels/${input.channelId}/messages`, {
          method: 'POST', body, signal,
          headers: { Authorization: `Bot ${input.client.token.replace(/^Bot\s+/i, '')}`,
            'Content-Type': 'application/json', 'User-Agent': DefaultUserAgent },
        });
      if (response.status !== 200) {
        throw Object.assign(new Error('discord_delivery_refused'), { status: response.status });
      }
      const message = /** @type {{ id?: unknown, channel_id?: unknown, author?: { id?: unknown, bot?: unknown } } | null} */ (await response.json());
      if (message?.channel_id !== input.channelId || message?.author?.id !== input.client.user.id
        || message?.author?.bot !== true) throw new Error('discord_delivery_scope_mismatch');
      return message;
    } finally { transport.close(); }
  };
}
