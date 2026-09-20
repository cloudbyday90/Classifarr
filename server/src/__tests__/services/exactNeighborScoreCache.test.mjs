/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createExactNeighborScoreCache, EXACT_NEIGHBOR_BUDGET } from '../../services/exactNeighborScoreCache.mjs';

const fixture = () => new Map([['q', [1, 0]], ['a', [.8, .6]], ['b', [.6, .8]], ['c', [0, 1]], ['d', [-1, 0]]]);

test('matches brute-force sorted top three, including negatives and ties, without admitting cached excluded references', async () => {
  const vectors = fixture(), cache = createExactNeighborScoreCache(vectors);
  for (const refs of [['a', 'b', 'c', 'd'], ['b', 'c', 'd'], ['c', 'd', 'a'], ['a', 'b', 'c', 'd']]) {
    const sorted = refs.map(hash => vectors.get(hash)[0]).sort((a, b) => b - a);
    expect(await cache.score('q', refs)).toEqual({ maximum: sorted[0], minimum: sorted[2], mean: (sorted[0] + sorted[1] + sorted[2]) / 3 });
  }
  expect(cache.stats()).toEqual({ computedComponents: 8, queryRows: 1, cachedScalars: 5, cacheHits: 10 });
  const ties = createExactNeighborScoreCache(new Map([['q', [1]], ['a', [1]], ['b', [1]], ['c', [1]]]));
  expect(await ties.score('q', ['a', 'b', 'c'])).toEqual({ maximum: 1, minimum: 1, mean: 1 });
});

test('scope, caller list mutation and cancellation cannot introduce self evidence or partial answers', async () => {
  const cache = createExactNeighborScoreCache(fixture());
  for (const refs of [['q'], ['absent'], ['a', 'a']]) await expect(cache.score('q', refs)).rejects.toThrow('scope_invalid');
  await expect(cache.score('missing', [])).rejects.toThrow('scope_invalid');
  const refs = ['a', 'b', 'c'], pending = cache.score('q', refs); refs.splice(0, 3, 'q');
  expect(await pending).toMatchObject({ maximum: .8, minimum: 0 });
  const controller = new AbortController(), aborted = cache.score('q', ['a'], { signal: controller.signal }); controller.abort();
  await expect(aborted).rejects.toThrow();
  await expect(cache.score('q', [], { signal: controller.signal })).rejects.toThrow();
  expect(await cache.score('q', ['a', 'b', 'c'])).toMatchObject({ maximum: .8 });
});

test('row, scalar and component budgets fail closed without eviction or unbounded work', async () => {
  for (const limits of [{ ...EXACT_NEIGHBOR_BUDGET, rows: 1 }, { ...EXACT_NEIGHBOR_BUDGET, scalars: 5 }]) {
    const cache = createExactNeighborScoreCache(fixture(), limits);
    await cache.score('q', ['a']);
    await expect(cache.score('a', ['b'])).rejects.toThrow('cache_budget');
    expect(cache.stats().queryRows).toBe(1);
  }
  const cache = createExactNeighborScoreCache(fixture(), { ...EXACT_NEIGHBOR_BUDGET, components: 2 });
  await cache.score('q', ['a']);
  await expect(cache.score('q', ['a', 'b'])).rejects.toThrow('work_budget');
  expect(cache.stats().computedComponents).toBe(2);
  expect(await cache.score('q', ['a'])).toMatchObject({ maximum: .8 });
  for (const limits of [{}, { ...EXACT_NEIGHBOR_BUDGET, rows: 0 }, { ...EXACT_NEIGHBOR_BUDGET, components: 2_000_000_001 }]) {
    expect(() => createExactNeighborScoreCache(fixture(), limits)).toThrow('budget_invalid');
  }
});

test('concurrent scans reuse only immutable pair values and independently honor membership', async () => {
  const cache = createExactNeighborScoreCache(fixture());
  const [a, b] = await Promise.all([cache.score('q', ['a', 'b', 'c']), cache.score('q', ['b', 'c', 'd'])]);
  expect(a.maximum).toBe(.8); expect(b.maximum).toBe(.6);
  expect(cache.stats().computedComponents).toBe(8);
  a.maximum = -1;
  expect((await cache.score('q', ['a', 'b', 'c'])).maximum).toBe(.8);
});

test('preflight rejects oversized fits before allocating or multiplying, and accounts for existing cached pairs', async () => {
  const cache = createExactNeighborScoreCache(fixture(), { ...EXACT_NEIGHBOR_BUDGET, components: 4 });
  await expect(cache.preflight(['q'], ['a', 'b', 'c'])).rejects.toThrow('work_budget');
  expect(cache.stats()).toMatchObject({ computedComponents: 0, cachedScalars: 0 });
  await cache.score('q', ['a']);
  await cache.preflight(['q', 'q'], ['q', 'a', 'b']);
  await cache.score('q', ['a', 'b']);
  await expect(cache.preflight(['q'], ['a', 'b'], { signal: AbortSignal.abort() })).rejects.toThrow();
  await expect(cache.preflight(['q'], ['unknown'])).rejects.toThrow('scope_invalid');
  await expect(createExactNeighborScoreCache(fixture(), { ...EXACT_NEIGHBOR_BUDGET, rows: 1 })
    .preflight(['q', 'a'], ['b'])).rejects.toThrow('cache_budget');
});
