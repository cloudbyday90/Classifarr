/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Agent, fetch as undiciFetch } from 'undici';

// The callback must consume the response body before returning. Streaming callers
// keep their existing native-fetch path and do not use this buffered transport.
export async function withBufferedHttpTransport(rejectUnauthorized, consumeResponse) {
  if (rejectUnauthorized !== false) return consumeResponse(globalThis.fetch);

  // An npm Undici Agent must use fetch from the same package; Node's bundled
  // fetch can implement an older dispatcher interface. Never change global TLS.
  const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  try {
    return await consumeResponse(undiciFetch, dispatcher);
  } finally {
    await dispatcher.destroy();
  }
}
