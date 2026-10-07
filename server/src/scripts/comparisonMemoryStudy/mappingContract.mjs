/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { MAPPING_FIELDS, MAPPING_CATEGORIES, MAPPING_BUCKETS, MAPPING_MAX_COUNT } from './mappingCounters.mjs';
const keys = (value, expected) => assert.deepEqual(Object.keys(value ?? {}).sort(), [...expected].sort());

export function assertComparisonMappings(value) {
  assert.ok(['complete', 'unavailable'].includes(value?.status));
  if (value.status === 'unavailable') { keys(value, ['status']); return; }
  keys(value, ['status', 'categories', 'writableSizeBuckets']);
  for (const [field, names] of [['categories', MAPPING_CATEGORIES], ['writableSizeBuckets', MAPPING_BUCKETS]]) {
    keys(value[field], names);
    for (const row of Object.values(value[field])) {
      keys(row, ['count', ...Object.values(MAPPING_FIELDS)]);
      for (const number of Object.values(row)) assert.ok(Number.isSafeInteger(number) && number >= 0);
      assert.ok(row.count <= MAPPING_MAX_COUNT && row.rssBytes <= row.sizeBytes && row.pssBytes <= row.rssBytes);
      assert.ok(row.anonymousBytes <= row.rssBytes && row.privateDirtyBytes <= row.rssBytes);
      if (row.count === 0) for (const number of Object.values(row)) assert.equal(number, 0);
      else assert.ok(row.sizeBytes > 0);
    }
  }
  const count = Object.values(value.categories).reduce((sum, row) => sum + row.count, 0);
  assert.ok(count > 0 && count <= MAPPING_MAX_COUNT);
  for (const key of ['count', ...Object.values(MAPPING_FIELDS)]) {
    assert.ok(Number.isSafeInteger(Object.values(value.categories).reduce((sum, row) => sum + row[key], 0)));
    assert.equal(Object.values(value.writableSizeBuckets).reduce((sum, row) => sum + row[key], 0), value.categories.anonymousWritable[key]);
  }
}

export function projectComparisonMappings(value) {
  try { assertComparisonMappings(value); return structuredClone(value); } catch { return undefined; }
}
