/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Readable } from 'node:stream';
import { HttpResponseTooLargeError, readBoundedResponseBody } from '../utils/httpResponseBody.mjs';

export class DiscordRestError extends Error {
  constructor(code, message) {
    super(message);
    // AbortError would make the SDK replay a potentially accepted notification.
    this.name = 'DiscordRestError';
    this.code = code;
  }
}

export async function bufferDiscordResponse(response, maxBytes) {
  const body = response.body && (typeof response.body.getReader === 'function'
    ? response.body
    : Readable.toWeb(response.body, {
      strategy: { highWaterMark: 64 * 1024, size: chunk => chunk.byteLength },
    }));
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) > maxBytes) {
    if (body) await Promise.allSettled([body.cancel()]);
    throw new HttpResponseTooLargeError(maxBytes);
  }
  const bytes = await readBoundedResponseBody({ body }, maxBytes);
  const buffered = new Response([204, 205, 304].includes(response.status) ? null : bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  return {
    body: buffered.body,
    get bodyUsed() { return buffered.bodyUsed; },
    headers: buffered.headers,
    status: buffered.status,
    statusText: buffered.statusText,
    ok: buffered.ok,
    arrayBuffer: () => buffered.arrayBuffer(),
    text: () => buffered.text(),
    async json() {
      try { return await buffered.json(); } catch {
        // JSON.parse's syntax error can contain credentials or provider content.
        throw new DiscordRestError('DISCORD_RESPONSE_INVALID', 'Discord returned invalid JSON');
      }
    },
  };
}
