/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { buildLocalCommunityGraph, COMMUNITY_NEIGHBORS } from '../../services/localCommunityGraph.mjs';
import { fitLocalCommunities } from '../../services/inventoryLocalCommunities.mjs';

const hash = value => value.toString(16).padStart(64, '0');
const row = (value, vector) => ({ hash: hash(value), vector });

test('discovers more than eight content themes, retaining a minority and separating a bridge and outlier', async () => {
  const items = Array.from({ length: 12 }, (_, theme) => Array.from({ length: theme ? 3 : 6 }, (_, i) =>
    row(theme * 10 + i, Array.from({ length: 13 }, (__, axis) => Number(axis === theme))))).flat();
  const bridge = row(200, [1, 1, ...Array(11).fill(0)]), outlier = row(201, [...Array(12).fill(0), 1]);
  items.push(bridge, outlier);
  const before = structuredClone(items), result = await fitLocalCommunities(items, 13);
  expect(result.groups).toHaveLength(12);
  expect(result.groups.map(group => group.support).sort((a, b) => b - a)).toEqual([6, ...Array(11).fill(3)]);
  expect(result.unassigned).toEqual([bridge.hash, outlier.hash]);
  expect(new Set(result.groups.flatMap(group => group.hashes)).size).toBe(39);
  expect(result.groups.every(group => group.meanSimilarity === 1 && group.representatives.length === 3)).toBe(true);
  expect(await fitLocalCommunities([...items].reverse(), 13)).toEqual(result);
  expect(items).toEqual(before);
});

test('accounts for unsupported data without forcing assignments or using hidden labels', async () => {
  expect(await fitLocalCommunities([], 2)).toMatchObject({ groups: [], unassigned: [] });
  const items = [row(1, [1, 0]), row(2, [-1, 0]), row(3, [0, 1])];
  expect(await fitLocalCommunities(items, 2)).toMatchObject({ groups: [], unassigned: items.map(item => item.hash) });
  const same = [1, 2, 3].map(id => row(id, [3, 4]));
  expect((await fitLocalCommunities(same, 2)).groups).toHaveLength(1);
  const decorated = same.map(item => ({ ...item, get library() { throw new Error('label accessed'); } }));
  expect(await fitLocalCommunities(decorated, 2)).toEqual(await fitLocalCommunities(same, 2));
});

test('caps tied neighborhoods and never grows an unbounded component', async () => {
  const items = Array.from({ length: 40 }, (_, i) => row(i, [1, 0]));
  const graph = await buildLocalCommunityGraph(items, 2);
  expect(graph.pairs).toBe(780);
  expect(graph.saturatedNeighborhoods).toBe(40);
  expect(graph.edges.every(edges => edges.size <= COMMUNITY_NEIGHBORS)).toBe(true);
  for (const [i, edges] of graph.edges.entries()) for (const j of edges.keys()) expect(graph.edges[j].has(i)).toBe(true);
  const result = await fitLocalCommunities(items, 2);
  expect(result.groups[0].support).toBe(17);
  expect(result.unassigned).toHaveLength(23);
});

test('rejects invalid vectors, duplicate hashes and memory/work budgets before expensive work', async () => {
  for (const [items, dimensions] of [[null, 2], [[row(1, [1, 0])], 0], [[row(1, [1, 0])], 16001],
    [[{ hash: 'private title', vector: [1, 0] }], 2], [[null], 2], [[row(1, [1]), row(1, [1])], 1],
    [Array(10001).fill(row(1, [1])), 1], [Array(9000).fill(row(1, [1])), 1000],
    [[row(1, [NaN, 0])], 2], [[row(1, [0, 0])], 2], [[row(1, [1])], 2]]) {
    await expect(fitLocalCommunities(items, dimensions)).rejects.toThrow();
  }
  await expect(fitLocalCommunities([], 2, { signal: AbortSignal.abort() })).rejects.toThrow();
  const controller = new AbortController();
  const promise = fitLocalCommunities(Array.from({ length: 1200 }, (_, i) => row(i, [1, 0])), 2, { signal: controller.signal });
  controller.abort(); await expect(promise).rejects.toThrow();
});

test('bounded ranked insertion retains strongest positive reciprocal neighbors', async () => {
  const items = Array.from({ length: 30 }, (_, i) => row(i, [Math.cos(i / 20), Math.sin(i / 20)]));
  const graph = await buildLocalCommunityGraph(items, 2);
  expect(graph.edges[15].size).toBeGreaterThan(0);
  for (const [i, edges] of graph.edges.entries()) for (const j of edges.keys()) {
    expect(Math.abs(i - j)).toBeLessThanOrEqual(8);
  }
  const result = await fitLocalCommunities(items, 2);
  expect(result.groups.length).toBeGreaterThan(1);
  expect(result.groups.flatMap(group => group.hashes).length + result.unassigned.length).toBe(items.length);
});
