/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SELECTED_RESTORE_MAX_BYTES } from '../bootstrap/embeddedSelectedMaintenanceContract.mjs';

const results = Object.freeze({ 0x43: 'complete', 0x44: 'deferred', 0x52: 'rejected', 0x45: 'unavailable' });

/** One inherited capability, never reopened/replayed. Caller retains input until settlement. */
export function createRestoreHandoffClient({ channel, timeoutMs = 190_000 }) {
  let used = false, closed = false, settle, timer, outcome;
  const finish = status => {
    clearTimeout(timer);
    closed = true;
    channel.destroy();
    const resolve = settle; settle = null;
    resolve?.({ status });
  };
  channel.on('error', () => finish('unavailable'));
  channel.on('close', () => { if (!closed) finish('unavailable'); });
  channel.on('end', () => finish(outcome || 'unavailable'));
  channel.on('data', chunk => {
    if (!settle || outcome || !Buffer.isBuffer(chunk) || chunk.length !== 1 || !Object.hasOwn(results, chunk[0])) {
      finish('unavailable'); return;
    }
    outcome = results[chunk[0]];
  });
  return { close: () => finish('unavailable'), request(bytes) {
    if (used || closed) return Promise.resolve({ status: 'unavailable' });
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > SELECTED_RESTORE_MAX_BYTES) {
      return Promise.resolve({ status: 'rejected' });
    }
    used = true;
    const promise = new Promise(resolve => { settle = resolve; });
    timer = setTimeout(() => finish('unavailable'), timeoutMs);
    const header = Buffer.alloc(4); header.writeUInt32BE(bytes.length);
    try {
      // Exactly two bounded writes. False means queued/backpressured, not failed.
      channel.write(header, error => { if (error) finish('unavailable'); });
      channel.write(bytes, error => { if (error) finish('unavailable'); });
    } catch { finish('unavailable'); }
    return promise;
  } };
}
