/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createLiveInventoryModelCache, estimateInventoryProfileWeight } from '../../services/liveInventoryModelCache.mjs';

const key = value => value.repeat(64);
test('bounds entries and weighted memory with LRU eviction, without returning cache internals', () => {
  const cache = createLiveInventoryModelCache({ maxEntries: 2, maxWeight: 10 });
  cache.set(key('a'), 'A', 4); cache.set(key('b'), 'B', 4);
  expect(cache.get(key('a'))).toBe('A');
  cache.set(key('c'), 'C', 4);
  expect(cache.get(key('b'))).toBeUndefined();
  cache.set(key('d'), 'D', 8);
  expect(cache.get(key('a'))).toBeUndefined(); expect(cache.get(key('c'))).toBeUndefined();
  expect(cache.get(key('d'))).toBe('D');
  expect(JSON.stringify(cache)).toBe('{}');
});

test('replacement updates weight, oversized models are not retained, and caches are isolated', () => {
  const cache = createLiveInventoryModelCache({ maxWeight: 10 });
  cache.set(key('a'), 'A', 8); cache.set(key('a'), 'B', 2); cache.set(key('b'), 'C', 8);
  expect(cache.get(key('a'))).toBe('B');
  expect(cache.set(key('a'), 'Too big', 11)).toBe(false);
  expect(cache.get(key('a'))).toBeUndefined(); expect(cache.get(key('b'))).toBe('C');
  expect(createLiveInventoryModelCache().get(key('b'))).toBeUndefined();
});

test('expiry is non-sliding and invalid or backwards clocks never serve an old model', () => {
  let time = 0;
  const cache = createLiveInventoryModelCache({ ttlMs: 10, now: () => time });
  cache.set(key('a'), 'A', 1); time = 9;
  expect(cache.get(key('a'))).toBe('A'); time = 10;
  expect(cache.get(key('a'))).toBeUndefined();
  for (const invalid of [9, NaN, Infinity]) {
    time = 10; cache.set(key('a'), 'A', 1); time = invalid;
    expect(cache.get(key('a'))).toBeUndefined();
  }
  expect(cache.set(key('a'), 'A', 1)).toBe(false);
});

test.each([{ maxEntries: 0 }, { maxWeight: -1 }, { ttlMs: Infinity }, { ttlMs: 1.5 }])('rejects unbounded configuration %j', options => {
  expect(() => createLiveInventoryModelCache(options)).toThrow('limits_invalid');
});
test.each([['bad', {}, 1], [key('a'), null, 1], [key('a'), {}, 0], [key('a'), {}, NaN]])('rejects invalid entry %s', (id, model, weight) => {
  expect(() => createLiveInventoryModelCache().set(id, model, weight)).toThrow('entry_invalid');
});
test('profile accounting includes feature strings and per-library overhead', () => {
  const empty = { profiles: new Map(), background: new Map() };
  expect(estimateInventoryProfileWeight(empty)).toBe(1024);
  empty.profiles.set(1, { fields: { genres: { counts: new Map([['test', 1]]) } } });
  empty.background.set('movie', { genres: { counts: new Map([['test', 1]]) } });
  expect(estimateInventoryProfileWeight(empty)).toBe(2320);
});
