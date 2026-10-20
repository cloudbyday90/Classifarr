/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const REUSE_ORDER = Object.freeze(['baseline','reuse','reuse','baseline','baseline','reuse','reuse','baseline']);
export const reuseSha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function requireReuseContentParity(original,candidate) {
  const expected = original.replaceAll('\r\n','\n').replaceAll(/from '\.\/([A-Za-z]+)\.mjs'/g,"from '/app/src/ollamaGateway/$1.mjs'");
  assert.equal(expected.split('let index = first;').length,2,'snapshot_reuse_source_drift');
  assert.equal(candidate.replaceAll('\r\n','\n'),expected,'snapshot_reuse_accumulator_drift');
}
export function requireReuseRuns(runs) {
  assert.equal(runs.length,REUSE_ORDER.length); assert.deepEqual(runs.map(row => row.mode),REUSE_ORDER);
  assert.equal(new Set(runs.map(row => `${row.sha256}:${row.chargedBytes}`)).size,1);
  for (const row of runs) {
    assert.equal(row.equivalent,true); assert.ok(row.queries > 0 && row.resultStringBytes > 0);
    assert.ok(Number.isSafeInteger(row.chargedBytes) && row.chargedBytes > 0 && row.chargedBytes <= 268435456);
    for (const key of ['elapsedMs','processCpuUs','queryMs']) assert.ok(Number.isFinite(row[key]) && row[key] >= 0);
  }
  for (const [before,after] of [[0,1],[3,2],[4,5],[7,6]]) {
    assert.ok(runs[after].queries < runs[before].queries); assert.ok(runs[after].resultStringBytes < runs[before].resultStringBytes);
  }
}
