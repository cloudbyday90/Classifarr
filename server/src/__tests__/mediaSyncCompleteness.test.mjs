/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { createMediaSyncCompleteness, ENUMERATION_LIMITS } from '../services/mediaSyncCompleteness.mjs';
import { sourcePageFixture } from './helpers/sourcePageFixture.mjs';
const page = (keys, total, offset = null) => sourcePageFixture(keys.map(external_id => ({ external_id })), { total, offset });

test('short pages advance by actual count and complete only against stable reported total', () => {
  const scan = createMediaSyncCompleteness();
  expect(scan.accept(page(['a'], 3, 0))).toBe(false);
  expect(scan.offset).toBe(1);
  expect(scan.total).toBe(3);
  expect(() => scan.receipt()).toThrow('completion_unproven');
  expect(scan.accept(page(['b', 'c'], 3, 1))).toBe(true);
  expect(scan.receipt()).toEqual({ version: 1, pages: 2, uniqueItems: 3, reportedTotal: 3 });
  expect(Object.isFrozen(scan.receipt())).toBe(true);
  expect(() => scan.accept(page([], 3, 3))).toThrow('enumeration_already_complete');
});
test('explicit zero is a complete empty dataset, not missing metadata', () => {
  const scan = createMediaSyncCompleteness();
  expect(scan.accept(page([], 0, 0))).toBe(true);
  expect(scan.receipt().uniqueItems).toBe(0);
});
test.each([
  ['premature_empty_page', page([], 3, 1)],
  ['repeated_source_key', page(['a'], 3, 1)],
  ['repeated_source_key', page(['b', 'b'], 3, 1)],
  ['unexpected_page_offset', page(['b'], 3, 0)],
  ['unexpected_page_offset', page(['b'], 3, 2)],
  ['changed_page_total', page(['b'], 4, 1)],
  ['changed_page_total', page(['b'], null, 1)],
  ['page_exceeds_total', page(['b', 'c', 'd'], 3, 1)],
])('%s prevents completion', (reason, next) => {
  const scan = createMediaSyncCompleteness();
  scan.accept(page(['a'], 3, 0));
  expect(() => scan.accept(next)).toThrow(reason);
  expect(scan.complete).toBe(false);
  expect(() => scan.receipt()).toThrow('completion_unproven');
  expect(() => scan.accept(page(['b', 'c'], 3, 1))).toThrow('enumeration_failed');
});
test('unknown total never silently becomes a complete enumeration', () => {
  const scan = createMediaSyncCompleteness();
  expect(scan.accept(page(['a'], null))).toBe(false);
  expect(() => scan.accept(page([], null))).toThrow('unknown_source_total');
});
test.each([null, {}, { items: [], keys: ['extra'], offset: 0, total: 0 }, page(Array(1001).fill('a'), 1001)])('rejects invalid envelopes', value => {
  expect(() => createMediaSyncCompleteness().accept(value)).toThrow('invalid_page_envelope');
});
test.each([-1, 0.5, '1', undefined, NaN, 2147483648])('rejects invalid totals %p', total => {
  expect(() => createMediaSyncCompleteness().accept({ ...page([], 0), total })).toThrow('invalid_page_total');
});
test('enforces page and item budgets even when provider never terminates', () => {
  const pages = createMediaSyncCompleteness();
  for (let i = 0; i < ENUMERATION_LIMITS.pages; i++) pages.accept(page([String(i)], null));
  expect(() => pages.accept(page(['overflow'], null))).toThrow('enumeration_limit');
  const items = createMediaSyncCompleteness();
  for (let i = 0; i < ENUMERATION_LIMITS.items / 1000; i++) {
    items.accept(page(Array.from({ length: 1000 }, (_, n) => `${i}:${n}`), null));
  }
  expect(() => items.accept(page(['overflow'], null))).toThrow('enumeration_limit');
});
