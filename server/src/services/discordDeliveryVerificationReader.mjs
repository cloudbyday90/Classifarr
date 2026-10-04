/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { DefaultRestOptions, DefaultUserAgent } from 'discord.js';
import { createDiscordRestTransport } from './discordRestTransport.mjs';
import { getDeliveryProof } from './discordDeliveryMarker.mjs';
import { verificationRetrySeconds } from './discordDeliveryVerificationContract.mjs';
import { createDiscordProviderGate } from './discordProviderGate.mjs';
import { DiscordDeliveryDeferredError } from './discordProviderCooldown.mjs';

/** No SDK request queue, Gateway connection, retries, redirects or provider writes. */
export function createDiscordDeliveryVerificationReader({ request = fetch, timeoutMs = 10000, cooldown = null,
  gate = cooldown ? createDiscordProviderGate({ cooldown }) : null } = {}) {
  return async ({ receipt, config, messageId, signal }) => {
    const transport = createDiscordRestTransport({
      request: (url, init) => request(url, { method: init.method, signal: init.signal, redirect: 'error',
        headers: /** @type {Record<string, string>} */ (init.headers) }),
      timeoutMs, maxBytes: 256 * 1024, maxConcurrent: 1,
    });
    const controller = new AbortController();
    const combined = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const objectBody = async response => {
      const body = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_response');
      return body;
    };
    const get = async path => {
      combined.throwIfAborted();
      const makeRequest = gate ? (url, init) => gate.run(transport.makeRequest, url, init) : transport.makeRequest;
      const response = await makeRequest(`${DefaultRestOptions.api}/v${DefaultRestOptions.version}${path}`, {
        method: 'GET', redirect: 'error', signal: combined,
        headers: { Authorization: `Bot ${config.bot_token.replace(/^Bot\s+/i, '')}`, Accept: 'application/json',
          'User-Agent': DefaultUserAgent },
      });
      if (response.status === 429) {
        const delay = response.headers.get('retry-after') ?? (await objectBody(response).catch(() => ({})))?.retry_after;
        return { code: 'rate_limited', retryAfterSeconds: verificationRetrySeconds(delay) };
      }
      if (response.status === 401 || response.status === 403) return { code: 'access_denied' };
      if (response.status === 404) return { code: 'message_unavailable' };
      if (response.status !== 200) return { code: 'provider_unavailable' };
      return { data: await objectBody(response) };
    };
    try {
      const identity = await get('/users/@me');
      if (identity.code) return identity;
      if (identity.data?.id !== receipt.bot_user_id || identity.data?.bot !== true) return { code: 'bot_changed' };
      const result = await get(`/channels/${receipt.channel_id}/messages/${messageId}`);
      if (result.code) return result;
      // Normalize only this authenticated provider response, never administrator input.
      const raw = result.data;
      const proof = getDeliveryProof({ id: raw.id, channelId: raw.channel_id, author: raw.author,
        type: raw.type, embeds: raw.embeds, nonce: raw.nonce, webhookId: raw.webhook_id,
        reference: raw.message_reference, messageSnapshots: { size: raw.message_snapshots?.length },
        partial: typeof raw.content !== 'string' || !Array.isArray(raw.embeds),
      }, receipt.bot_user_id);
      if (!proof || proof.messageId !== messageId || proof.channelId !== receipt.channel_id
        || proof.classificationId !== String(receipt.classification_id) || proof.nonce !== receipt.nonce
        || proof.correlationVersion !== 1) return { code: 'proof_mismatch' };
      return { code: 'verified', proof };
    } catch (error) {
      if (error instanceof DiscordDeliveryDeferredError) return { code: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
      return { code: signal?.aborted ? 'cancelled' : controller.signal.aborted ? 'timed_out' : 'provider_unavailable' };
    } finally {
      clearTimeout(timer);
      transport.close();
    }
  };
}
