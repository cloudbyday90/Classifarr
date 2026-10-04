/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { addAbortListener } from 'node:events';
import { DefaultRestOptions } from 'discord.js';
import { HttpResponseTooLargeError } from '../utils/httpResponseBody.mjs';
import { bufferDiscordResponse, DiscordRestError } from './discordRestResponse.mjs';

/** One lifecycle per Discord client, with no work or timers while idle. */
export function createDiscordRestTransport({
  request = DefaultRestOptions.makeRequest,
  timeoutMs = 15000,
  maxBytes = 4 * 1024 * 1024,
  maxConcurrent = 16,
} = {}) {
  for (const value of [timeoutMs, maxBytes, maxConcurrent]) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError('Discord transport limits must be positive safe integers');
    }
  }
  if (timeoutMs > 2147482647) throw new TypeError('Discord transport deadline exceeds timer range');
  const active = new Set();
  let closed = false;

  return {
    // Leave a small SDK backstop; this adapter owns the body-inclusive deadline.
    timeout: timeoutMs + 1000,
    async makeRequest(url, init) {
      const createsMessage = init.method?.toUpperCase() === 'POST'
        && /\/channels\/[0-9]+\/messages$/.test(new URL(url).pathname);
      if (closed) throw new DiscordRestError('DISCORD_TRANSPORT_CLOSED', 'Discord client is closed');
      if (init.signal?.aborted) {
        throw new DiscordRestError('DISCORD_REQUEST_CANCELLED', 'Discord request cancelled');
      }
      if (active.size >= maxConcurrent) {
        throw new DiscordRestError('DISCORD_TRANSPORT_BUSY', 'Discord request capacity reached');
      }
      const controller = new AbortController();
      active.add(controller);
      const listener = init.signal && addAbortListener(init.signal, () => {
        controller.abort(new DiscordRestError('DISCORD_REQUEST_CANCELLED', 'Discord request cancelled'));
      });
      const timer = setTimeout(() => {
        controller.abort(new DiscordRestError('DISCORD_REQUEST_TIMEOUT', 'Discord response deadline exceeded'));
      }, timeoutMs);
      let receivedHeaders = false;
      try {
        const response = await request(url, { ...init, signal: controller.signal });
        receivedHeaders = true;
        const buffered = await bufferDiscordResponse(response, maxBytes);
        if (controller.signal.aborted) throw controller.signal.reason;
        if (createsMessage && buffered.status >= 500) {
          throw new DiscordRestError('DISCORD_WRITE_UNCONFIRMED', 'Discord message delivery is unconfirmed');
        }
        return buffered;
      } catch (error) {
        const failure = controller.signal.aborted ? controller.signal.reason
          : error instanceof HttpResponseTooLargeError
            ? new DiscordRestError('DISCORD_RESPONSE_TOO_LARGE', 'Discord response exceeds the byte limit')
            : new DiscordRestError(createsMessage ? 'DISCORD_WRITE_UNCONFIRMED'
              : !receivedHeaders && error?.code === 'ECONNRESET' ? 'ECONNRESET' : 'DISCORD_TRANSPORT_FAILED',
              'Discord transport request failed');
        // Abort the actual transport, not just a Promise.race that leaves I/O alive.
        controller.abort(failure);
        throw failure;
      } finally {
        clearTimeout(timer);
        listener?.[Symbol.dispose]();
        active.delete(controller);
      }
    },
    close() {
      closed = true;
      for (const controller of active) {
        controller.abort(new DiscordRestError('DISCORD_TRANSPORT_CLOSED', 'Discord client is closed'));
      }
    },
  };
}
