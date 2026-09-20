/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { selectCompactInventoryEvidence as select, COMPACT_EVIDENCE_SELECTION } from '../../services/inventoryCompactEvidence.mjs';

const row = (id, vector, description = `Example ${id}`) => ({ hash: id.toString(16).padStart(64, '0'), vector, description });

test('keeps the strongest match, removes near duplicates and never fills with nonpositive matches', () => {
  const rows = [row(1, [1, 0]), row(2, [1, 0.01]), row(3, [0.8, 0.6]), row(4, [0, 1]), row(5, [-1, 0])];
  const before = structuredClone(rows), selected = select([2, 0], rows);
  expect(selected.map(item => item.hash)).toEqual([rows[0].hash, rows[2].hash]);
  expect(selected[0]).toEqual({ hash: rows[0].hash, description: 'Example 1', similarity: 1, sharedAcrossCandidates: false });
  expect(rows).toEqual(before);
  expect(select([1, 0], [...rows].reverse())).toEqual(selected);
  expect(COMPACT_EVIDENCE_SELECTION).toMatchObject({ version: 'query_mmr_v1', maximumExamples: 3, relevanceWeight: 0.8 });
  expect(Object.isFrozen(COMPACT_EVIDENCE_SELECTION)).toBe(true);
});

test('caps examples, breaks equal relevance by hash, and does not leak vectors or arbitrary fields', () => {
  const rows = [row(4, [1, 0, 0, 1]), row(2, [1, 1, 0, 0]), row(3, [1, 0, 1, 0]), row(1, [1, 0, 0, -1])];
  rows[0].secret = 'PRIVATE';
  const selected = select([1, 0, 0, 0], rows);
  expect(selected).toHaveLength(3); expect(selected[0].hash).toBe(rows[3].hash);
  expect(select([1, 0, 0, 0], [...rows].reverse())).toEqual(selected);
  expect(JSON.stringify(selected)).not.toMatch(/PRIVATE|vector|secret/);
});

test('balances relevance against redundancy rather than merely taking the nearest three', () => {
  const rows = [row(1, [0.8, 0.6, 0]), row(2, [0.75, 0.2, Math.sqrt(0.3975)]),
    row(3, [0.7, -0.7, Math.sqrt(0.02)])];
  expect(select([1, 0, 0], rows).map(item => item.hash)).toEqual([rows[0].hash, rows[2].hash, rows[1].hash]);
});

test('deduplicates actual normalized/truncated displayed text, including Unicode', () => {
  const text = '🦊'.repeat(600), rows = [row(1, [1, 0], text + ' first'), row(2, [0.8, 0.6], text + ' second')];
  expect(select([1, 0], rows)).toHaveLength(1);
  expect([...select([1, 0], rows)[0].description]).toHaveLength(600);
});

test('leaves sparse and unhelpful pools unfilled, including nonpositive marginal utility', () => {
  expect(select([1, 0], [])).toEqual([]);
  expect(select([1, 0], [row(1, [-1, 0]), row(2, [0, 1])])).toEqual([]);
  // Second vector is positively query-related but too redundant for its tiny relevance gain.
  const rows = [row(1, [0.3, 0.954]), row(2, [0.01, 0.999])];
  expect(select([1, 0], rows)).toHaveLength(1);
});

test.each([
  () => null,
  () => Array.from({ length: 10 }, (_, i) => row(i, [1, 0])),
  () => [row(1, [1, 0]), row(1, [0, 1])],
  () => [{ ...row(1, [1, 0]), hash: 'bad' }],
  () => [row(1, [1, 0]), row(2, [NaN, 0])],
  () => [row(1, [1, 0]), row(2, [0, 0])],
  () => [row(1, [1, 0]), row(2, [1, 2, 3])],
  () => [row(1, [1, 0]), row(2, [-1, 0], '')],
  () => Array(1),
])('rejects all malformed rows before relevance filtering %#', makeRows => {
  expect(() => select([1, 0], makeRows())).toThrow();
});

test('validates the query even for an empty pool', () => {
  expect(() => select([0, 0], [])).toThrow(); expect(() => select(undefined, [])).toThrow();
});
