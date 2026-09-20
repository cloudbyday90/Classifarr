/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';

export const EXACT_NEIGHBOR_BUDGET = Object.freeze({ scalars: 4_000_000, rows: 512, components: 2_000_000_000 });

/** Internal cache over privately owned normalized vectors. Membership is supplied anew for every scan. */
export function createExactNeighborScoreCache(vectors, limits = EXACT_NEIGHBOR_BUDGET) {
  if (Object.keys(EXACT_NEIGHBOR_BUDGET).some(key => !Number.isSafeInteger(limits[key]) ||
      limits[key] < 1 || limits[key] > EXACT_NEIGHBOR_BUDGET[key])) throw new Error('exact_neighbor_budget_invalid');
  const budget = { ...limits }, slots = new Map([...vectors.keys()].map((hash, index) => [hash, index]));
  const rows = new Map();
  let components = 0, cacheHits = 0;
  return Object.freeze({
    stats: () => ({ computedComponents: components, cachedScalars: rows.size * slots.size, queryRows: rows.size, cacheHits }),
    async preflight(queryHashes, referenceHashes, { signal } = {}) {
      const queries = [...new Set(queryHashes)], references = [...new Set(referenceHashes)];
      if ([...queries, ...references].some(hash => !slots.has(hash))) throw new Error('exact_neighbor_scope_invalid');
      const newRows = queries.filter(hash => !rows.has(hash)).length;
      if (rows.size + newRows > budget.rows || (rows.size + newRows) * slots.size > budget.scalars) throw new Error('exact_neighbor_cache_budget');
      let required = 0;
      for (const hash of queries) {
        await setImmediate(undefined, { signal });
        const row = rows.get(hash), dimensions = vectors.get(hash).length;
        for (const reference of references) if (reference !== hash && (!row || Number.isNaN(row[slots.get(reference)]))) required += dimensions;
        if (components + required > budget.components) throw new Error('exact_neighbor_work_budget');
      }
      signal?.throwIfAborted();
    },
    async score(queryHash, referenceHashes, { signal } = {}) {
      signal?.throwIfAborted();
      const query = vectors.get(queryHash), references = [...referenceHashes];
      if (!query || new Set(references).size !== references.length ||
          references.some(hash => hash === queryHash || !slots.has(hash))) throw new Error('exact_neighbor_scope_invalid');
      if (!rows.has(queryHash)) {
        if (rows.size >= budget.rows || (rows.size + 1) * slots.size > budget.scalars) throw new Error('exact_neighbor_cache_budget');
        rows.set(queryHash, new Float64Array(slots.size).fill(NaN));
      }
      const row = rows.get(queryHash);
      let first = -1, second = -1, third = -1;
      for (let index = 0; index < references.length; index++) {
        if (index % 128 === 0) await setImmediate(undefined, { signal });
        const hash = references[index], slot = slots.get(hash);
        let value = row[slot];
        if (Number.isNaN(value)) {
          if (components + query.length > budget.components) throw new Error('exact_neighbor_work_budget');
          components += query.length;
          const vector = vectors.get(hash);
          let dot = 0;
          for (let axis = 0; axis < query.length; axis++) dot += query[axis] * vector[axis];
          value = Math.max(-1, Math.min(1, dot)); row[slot] = value;
        } else cacheHits++;
        if (value > first) { third = second; second = first; first = value; }
        else if (value > second) { third = second; second = value; }
        else if (value > third) third = value;
      }
      signal?.throwIfAborted();
      return { maximum: first, minimum: third, mean: (first + second + third) / 3 };
    },
  });
}
