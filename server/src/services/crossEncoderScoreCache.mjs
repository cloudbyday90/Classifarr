/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { validateCrossEncoderInput } from './localCrossEncoderClient.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = (entry, status) => ({ status, scores: [...entry.scores] });
const unavailable = () => ({ status: 'unavailable', scores: [] });

/** Request-driven SWR. Callers supply current trusted source/access revisions, never provider text. */
export function createCrossEncoderScoreCache({ client, now = Date.now, maxEntries = 128,
  freshMs = 60_000, staleMs = 300_000, cooldownMs = 1_000 } = {}) {
  if (typeof client?.score !== 'function' || !Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 128 ||
      [freshMs, staleMs, cooldownMs].some(value => !Number.isSafeInteger(value) || value < 1) ||
      freshMs > staleMs || staleMs > 300_000 || cooldownMs > 30_000) throw new Error('cross_encoder_cache_options_invalid');
  const entries = new Map();
  let scopeKey, disposed = false;
  function clear() {
    for (const entry of entries.values()) entry.controller?.abort();
    entries.clear();
  }
  function refresh(key, entry, input) {
    if (entry.pending || now() < entry.retryAt) return entry.pending;
    const controller = new AbortController(); entry.controller = controller;
    entry.pending = Promise.resolve().then(() => client.score(input, { signal: controller.signal })).then(result => {
      if (controller.signal.aborted || disposed || entries.get(key) !== entry) return unavailable();
      if (!Array.isArray(result?.scores) || result.scores.length !== input.texts.length ||
          result.scores.some(score => typeof score !== 'number' || !Number.isFinite(score))) throw new Error('cross_encoder_response_invalid');
      entry.scores = [...result.scores]; entry.at = now(); entry.failures = 0; entry.retryAt = 0;
      return copy(entry, 'fresh');
    }).catch(error => {
      if (entries.get(key) === entry && !controller.signal.aborted) {
        if (['cross_encoder_identity_invalid', 'cross_encoder_response_invalid', 'cross_encoder_input_rejected'].includes(error?.message)) {
          entries.delete(key); // Invalid identity/output is not an outage eligible for stale reuse.
        } else {
          entry.failures = Math.min(entry.failures + 1, 6);
          entry.retryAt = now() + Math.min(30_000, cooldownMs * 2 ** (entry.failures - 1));
        }
      }
      return unavailable();
    }).finally(() => { entry.pending = null; entry.controller = null; });
    return entry.pending;
  }
  async function wait(pending, signal) {
    if (!signal) return pending;
    signal.throwIfAborted();
    let cancel;
    try { return await Promise.race([pending, new Promise((_, reject) => {
      cancel = () => reject(signal.reason); signal.addEventListener('abort', cancel, { once: true });
    })]); } finally { signal.removeEventListener('abort', cancel); }
  }
  return {
    async get(scope, value, { signal } = {}) {
      signal?.throwIfAborted();
      if (disposed) throw new Error('cross_encoder_cache_disposed');
      const fields = ['model', 'source', 'representation', 'access'];
      if (!scope || Object.keys(scope).length !== fields.length || fields.some(field =>
        typeof scope[field] !== 'string' || !/^[a-f0-9]{64}$/.test(scope[field]))) throw new Error('cross_encoder_cache_scope_invalid');
      const input = validateCrossEncoderInput(value), current = digest(fields.map(field => scope[field]));
      if (scopeKey !== current) { clear(); scopeKey = current; }
      const key = digest([scopeKey, input]);
      let entry = entries.get(key);
      if (!entry) {
        if (entries.size >= maxEntries) {
          const oldest = entries.keys().next().value;
          entries.get(oldest).controller?.abort(); entries.delete(oldest);
        }
        entry = { scores: null, at: 0, retryAt: 0, failures: 0, pending: null, controller: null };
        entries.set(key, entry);
      }
      const age = now() - entry.at;
      if (entry.scores && age >= 0 && age < freshMs) return copy(entry, 'fresh');
      const pending = refresh(key, entry, input);
      if (entry.scores && age >= 0 && age < staleMs) return copy(entry, 'stale');
      const result = pending ? await wait(pending, signal) : unavailable();
      signal?.throwIfAborted();
      if (entries.get(key) !== entry) return unavailable();
      return result.scores.length ? { ...result, scores: [...result.scores] } : unavailable();
    },
    invalidate() { clear(); scopeKey = undefined; },
    async dispose() {
      disposed = true;
      const pending = [...entries.values()].map(entry => entry.pending);
      clear(); await Promise.allSettled(pending);
    },
  };
}
