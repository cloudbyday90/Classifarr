/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';

/** Repository-private completed models only. Fresh input validation belongs to the caller. */
export function createLiveInventoryModelCache({ maxEntries = 8, maxWeight = 16 * 1024 * 1024,
  ttlMs = 300_000, now = () => performance.now() } = {}) {
  if (![maxEntries, maxWeight, ttlMs].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new RangeError('live_inventory_model_cache_limits_invalid');
  }
  const entries = new Map();
  let weight = 0;
  const remove = key => { weight -= entries.get(key).weight; entries.delete(key); };
  const prune = () => {
    const time = now();
    for (const [key, entry] of entries) {
      if (!Number.isFinite(time) || time < entry.createdAt || time - entry.createdAt >= ttlMs) remove(key);
    }
    return time;
  };
  const validKey = key => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);
  return Object.freeze({
    get(key) {
      prune();
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key); entries.set(key, entry);
      return entry.model;
    },
    set(key, model, estimatedWeight) {
      const time = prune();
      if (!validKey(key) || model == null || !Number.isSafeInteger(estimatedWeight) || estimatedWeight < 1) {
        throw new Error('live_inventory_model_cache_entry_invalid');
      }
      if (entries.has(key)) remove(key);
      if (!Number.isFinite(time) || estimatedWeight > maxWeight) return false;
      while (entries.size >= maxEntries || weight + estimatedWeight > maxWeight) remove(entries.keys().next().value);
      entries.set(key, { model, weight: estimatedWeight, createdAt: time });
      weight += estimatedWeight;
      return true;
    },
  });
}

/** Conservative accounting units for Maps/strings; not an exact V8 heap measurement. */
export function estimateInventoryProfileWeight(model) {
  let weight = 1024 + model.profiles.size * 1024;
  for (const fields of [...model.background.values(), ...[...model.profiles.values()].map(profile => profile.fields)]) {
    for (const field of Object.values(fields)) {
      for (const term of field.counts.keys()) weight += 128 + term.length * 2;
    }
  }
  return weight;
}
