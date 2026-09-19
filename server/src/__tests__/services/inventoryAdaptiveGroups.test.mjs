/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { fitAdaptiveGroups, ADAPTIVE_GROUP_LIMIT } from '../../services/inventoryAdaptiveGroups.mjs';
import { proposeAdaptiveSplit } from '../../services/adaptiveGroupSplit.mjs';
import { representativeFitFixture } from '../helpers/representativeFitFixture.mjs';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
function themes(levels = 4, perTheme = 24) {
  return Array.from({ length: 2 ** levels }, (_, theme) => Array.from({ length: perTheme }, (_, i) => ({
    hash: hash(`${theme}:${i}`), vector: [1, ...Array.from({ length: levels }, (_, level) =>
      (theme & (1 << level) ? 1 : -1) * 0.7 ** level), (i - perTheme / 2) * 0.0001],
  }))).flat();
}

test('discovers more than eight supported content groups without labels and preserves every member', async () => {
  const items = themes(), before = structuredClone(items);
  const result = await fitAdaptiveGroups(items, 6);
  expect(result.groups.length).toBeGreaterThan(8);
  expect(result.groups.length).toBeLessThanOrEqual(ADAPTIVE_GROUP_LIMIT);
  expect(result.unassigned).toEqual([]);
  expect(result.groups.flatMap(group => group.hashes).sort()).toEqual(items.map(row => row.hash).sort());
  expect(result.groups.every(group => group.support >= 3 && group.representatives.length === 3)).toBe(true);
  expect(result.diagnostics.acceptedSplits).toBe(result.groups.length - 1);
  expect(result.diagnostics.attemptedSplits).toBeLessThanOrEqual(63);
  expect(await fitAdaptiveGroups([...items].reverse(), 6)).toEqual(result);
  expect(items).toEqual(before);
});

test('identical geometry stays in one group; sparse or cancelling geometry remains explicit', async () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ hash: hash(i), vector: [1, 0] }));
  const result = await fitAdaptiveGroups(items, 2);
  expect(result.groups).toHaveLength(1);
  expect(result.diagnostics.stops).toEqual({ no_training_variation: 1 });
  expect((await fitAdaptiveGroups(items.slice(0, 2), 2)).unassigned).toHaveLength(2);
  expect((await fitAdaptiveGroups([], 2)).groups).toEqual([]);
  expect((await fitAdaptiveGroups(items.slice(0, 4).map((row, i) => ({ ...row, vector: [i % 2 ? -1 : 1, 0] })), 2)).unassigned).toHaveLength(4);
  expect(await proposeAdaptiveSplit(items.slice(0, 4))).toEqual({ reason: 'insufficient_support' });
});

test('finite depth/group budgets bound rich data while retaining rare and unsupported examples', async () => {
  const items = themes(6, 12), result = await fitAdaptiveGroups(items, 8);
  expect(result.groups.length).toBeLessThanOrEqual(32);
  expect(result.diagnostics.attemptedSplits).toBeLessThanOrEqual(63);
  expect(result.groups.reduce((sum, group) => sum + group.support, result.unassigned.length)).toBe(items.length);
  const rare = themes(1, 20).concat([{ hash: hash('rare'), vector: [0, 0, 1] }]);
  const fitted = await fitAdaptiveGroups(rare, 3);
  expect([...fitted.groups.flatMap(group => group.hashes), ...fitted.unassigned]).toContain(hash('rare'));
});

test.each([
  [null, 2], [[{ hash: 'secret', vector: [1, 0] }], 2], [[{ hash: hash(1), vector: [1] }], 2],
  [[{ hash: hash(1), vector: [NaN, 1] }], 2], [[{ hash: hash(1), vector: [0, 0] }], 2],
  [[{ hash: hash(1), vector: [1, 0] }, { hash: hash(1), vector: [0, 1] }], 2], [[], 0], [[], 16001],
  [Array(10001).fill({ hash: hash(1), vector: [1, 0] }), 2], [themes(), 16000],
])('rejects malformed or excessive input without source payloads in errors (%#)', async (items, dimensions) => {
  await expect(fitAdaptiveGroups(items, dimensions)).rejects.toThrow();
});

test('cancels before starting and during fitting without mutating input', async () => {
  const items = representativeFitFixture(68, 600, 4), before = structuredClone(items), controller = new AbortController();
  const promise = fitAdaptiveGroups(items, 4, { signal: controller.signal });
  await setImmediate(); controller.abort();
  await expect(promise).rejects.toThrow();
  await expect(fitAdaptiveGroups(items, 4, { signal: controller.signal })).rejects.toThrow();
  expect(items).toEqual(before);
});
