/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export class HttpResponseTooLargeError extends Error {
  constructor(maxBytes) {
    super('HTTP response exceeds the configured byte limit');
    this.name = 'HttpResponseTooLargeError';
    this.code = 'HTTP_RESPONSE_TOO_LARGE';
    this.maxBytes = maxBytes;
  }
}

export function validateResponseByteLimit(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError('Response byte limit must be a nonnegative safe integer');
  }
}

/** Count decoded bytes, independently of Content-Length and content encoding. */
export async function readBoundedResponseBody(response, maxBytes) {
  validateResponseByteLimit(maxBytes);
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  let buffer = Buffer.alloc(0);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > maxBytes - length) throw new HttpResponseTooLargeError(maxBytes);
      const nextLength = length + value.byteLength;
      if (nextLength > buffer.length) {
        const capacity = Math.min(maxBytes, Math.max(nextLength, buffer.length * 2, 16384));
        const next = Buffer.alloc(capacity);
        buffer.copy(next, 0, 0, length);
        buffer = next;
      }
      buffer.set(value, length);
      length = nextLength;
    }
    return buffer.subarray(0, length);
  } catch (error) {
    // Cleanup failures must not replace the size/transport failure or leak a body.
    await Promise.allSettled([reader.cancel()]);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function parseHttpResponseBody(response, maxBytes) {
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  // Keep body I/O outside the JSON syntax catch, including for unbudgeted callers.
  const text = maxBytes === undefined ? await response.text()
    : new TextDecoder().decode(await readBoundedResponseBody(response, maxBytes));
  if (!isJson) return text;
  try { return JSON.parse(text); } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}
