/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), expected.split(' ').sort());
const integer = (value, max) => assert.ok(Number.isSafeInteger(value) && value >= 0 && value <= max);

export function assertVectorReadObservation(report) {
  keys(report, 'owned overlap');
  let events = 0;
  for (const scope of ['owned', 'overlap']) {
    keys(report[scope], 'read decode');
    for (const stage of ['read', 'decode']) {
      const row = report[scope][stage];
      keys(row, 'batches rows components encodedChars');
      integer(row.batches, 8192); events += row.batches;
      integer(row.rows, row.batches * 10000);
      integer(row.components, row.rows * 16000); assert.ok(row.components >= row.rows);
      integer(row.encodedChars, row.rows ? row.batches * 1_000_000_000 : 0);
    }
  }
  integer(events, 8192);
}
