/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { projectRepresentativeQuery, bindRepresentativeDecision } from './inventoryRepresentativeShadowInput.mjs';
import { compareInventoryRepresentativeShadow, representativeNoveltyKey, REPRESENTATIVE_SHADOW_REASONS } from './inventoryRepresentativeShadowScorer.mjs';

export const REPRESENTATIVE_SHADOW_VERSION = 'inventory_representative_shadow_v1';
export const REPRESENTATIVE_SHADOW_COUNTERS = Object.freeze([...REPRESENTATIVE_SHADOW_REASONS,
  'missing_query', 'duplicate', 'expired', 'capacity', 'invalidated_batches']);
const LIMIT = 32, COMPONENT_LIMIT = 262144, TTL = 300000;

/** Bounded ephemeral capsules and decision-time observations; no media objects are retained. */
export function createInventoryRepresentativeShadow({ now = Date.now, monotonic = () => performance.now() } = {}) {
  let bindings = new WeakMap(), stopped = false;
  const captured = new Map(), pending = new Map(), seen = new Map();
  const counts = Object.fromEntries(REPRESENTATIVE_SHADOW_COUNTERS.map(key => [key, 0]));
  const latency = { under_1ms: 0, under_10ms: 0, at_least_10ms: 0 };
  const increment = key => { counts[key] = Math.min(1000000, counts[key] + 1); };
  const prune = () => {
    const time = now();
    for (const store of [captured, pending]) for (const [key, value] of store) {
      if (!Number.isFinite(time) || !Number.isFinite(value.createdAt) || time < value.createdAt || time - value.createdAt >= TTL) {
        store.delete(key); if (store === pending) increment('expired');
      }
    }
    for (const [key, createdAt] of seen) if (!Number.isFinite(time) || time < createdAt || time - createdAt >= 1800000) seen.delete(key);
  };
  const room = (store, vector) => store.size < LIMIT &&
    [...store.values()].reduce((sum, value) => sum + value.vector.length, vector.length) <= COMPONENT_LIMIT;
  const clear = () => { bindings = new WeakMap(); captured.clear(); pending.clear(); seen.clear(); };
  return {
    clear,
    stop() { stopped = true; clear(); },
    hasPending() { prune(); return pending.size > 0; },
    read() { prune(); return { version: REPRESENTATIVE_SHADOW_VERSION, routingAffected: false,
      status: stopped ? 'unavailable' : 'available', pending: pending.size, counts: { ...counts }, latency: { ...latency } }; },
    remember(metadata, input) {
      if (stopped) return;
      prune();
      try {
        const createdAt = now();
        if (!Number.isFinite(createdAt)) throw new Error('representative_clock_invalid');
        const query = projectRepresentativeQuery(input), old = bindings.get(metadata);
        if (old) captured.delete(old);
        if (!room(captured, query.vector)) { increment('capacity'); return; }
        const token = {}; bindings.set(metadata, token);
        captured.set(token, { ...query, createdAt });
      } catch { increment('invalid_input'); }
    },
    observe(input) {
      if (stopped) return;
      prune();
      try {
        const token = bindings.get(input.metadata), query = captured.get(token);
        bindings.delete(input.metadata); captured.delete(token);
        if (!query) { increment('missing_query'); return; }
        const observation = bindRepresentativeDecision(query, input), key = `${query.key}:${query.hash}`;
        if (seen.has(key)) { increment('duplicate'); return; }
        if (!room(pending, observation.vector)) { increment('capacity'); return; }
        while (seen.size >= 1024) seen.delete(seen.keys().next().value);
        seen.set(key, now()); pending.set(key, observation);
      } catch { increment('invalid_input'); }
    },
    prepare(context) {
      prune();
      if (stopped || !pending.size) return null;
      const noveltyKey = representativeNoveltyKey(context.snapshot), batch = [...pending].slice(0, 8);
      const results = batch.map(([key, observation]) => {
        const start = monotonic();
        const reason = compareInventoryRepresentativeShadow({ ...context, observation });
        const duration = monotonic() - start;
        return { key, observation, reason, duration };
      });
      let committed = false;
      return { commit(fresh) {
        if (committed || stopped) return; committed = true;
        try {
          if (representativeNoveltyKey(fresh) !== noveltyKey) { increment('invalidated_batches'); return; }
        } catch { increment('invalidated_batches'); return; }
        prune();
        for (const { key, observation, reason, duration } of results) {
          if (pending.get(key) !== observation) continue;
          pending.delete(key); increment(reason);
          if (Number.isFinite(duration) && duration >= 0) {
            const bucket = duration < 1 ? 'under_1ms' : duration < 10 ? 'under_10ms' : 'at_least_10ms';
            latency[bucket] = Math.min(1000000, latency[bucket] + 1);
          }
        }
      } };
    },
  };
}
