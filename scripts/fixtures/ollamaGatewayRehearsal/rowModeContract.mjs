/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const ROW_ORDER = Object.freeze(['object','array','array','object','object','array','array','object']);
export const normalizeRowSource = text => text.replaceAll('\r\n', '\n');
export const rowSha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const once = (source, from, to) => {
  assert.equal(source.split(from).length, 2, 'row_mode_source_drift'); return source.replace(from, to);
};
export function requireRowParity(reader, content, candidate, accumulator) {
  const rebase = source => normalizeRowSource(source).replaceAll(/from '\.\/([A-Za-z]+)\.mjs'/g,
    "from '/app/src/ollamaGateway/$1.mjs'");
  let expected = rebase(reader);
  expected = once(expected, "import { gatewayError } from '/app/src/ollamaGateway/errors.mjs';",
    "import { gatewayError } from '/app/src/ollamaGateway/errors.mjs';\nimport { requireArrayFields } from './rowModeContract.mjs';");
  expected = once(expected, "const rows = (await client.query('FETCH FORWARD 16 FROM gateway_catalog_cursor')).rows;",
    "const result = await client.query({ text: 'FETCH FORWARD 16 FROM gateway_catalog_cursor', rowMode: 'array' });\n      requireArrayFields(result, dependencies);\n      const rows = result.rows;");
  for (const [from,to] of [['row.bytes','row[1]'],['row.required','row[2]'],['row.row','row[dependencies ? 3 : 1]'],['row.id','row[0]']]) {
    assert.ok(expected.includes(from)); expected = expected.replaceAll(from, to);
  }
  assert.equal(normalizeRowSource(candidate), expected, 'row_mode_candidate_drift');
  let common = rebase(content);
  common = once(common, 'budget, version = 1)', 'budget, version = 1, visit = visitCatalogRows)');
  common = once(common, 'await visitCatalogRows(client,', 'await visit(client,');
  assert.equal(normalizeRowSource(accumulator), common, 'row_mode_accumulator_drift');
}
export function requireArrayFields(result, dependencies) {
  const expected = dependencies ? [['id',2950],['bytes',23],['required',16],['row',25]] : [['id',2950],['row',25]];
  assert.deepEqual(result.fields.map(field => [field.name,field.dataTypeID,field.format]), expected.map(([name,oid]) => [name,oid,'text']));
  assert.ok(Array.isArray(result.rows) && result.rows.length <= 16);
  assert.ok(result.rows.every(row => Array.isArray(row) && row.length === expected.length && typeof row[0] === 'string'));
}
export function requireRowRuns(runs, lane) {
  assert.ok(['natural','allocations'].includes(lane)); assert.equal(runs.length, ROW_ORDER.length);
  assert.deepEqual(runs.map(row => row.mode), ROW_ORDER);
  for (const row of runs) {
    assert.equal(row.lane, lane); assert.equal(row.equivalent, true); assert.equal(row.fetchedRows, 3002);
    assert.ok(Number.isSafeInteger(row.bodyBytes) && row.bodyBytes > 220000000 && row.bodyBytes <= 268435456);
    assert.ok(Number.isSafeInteger(row.chargedBytes) && row.chargedBytes === row.bodyBytes + row.fetchedRows && row.chargedBytes <= 268435456);
    for (const key of ['elapsedMs','queryMs','processCpuUs']) assert.ok(Number.isFinite(row[key]) && row[key] >= 0);
    assert.ok(row.elapsedMs <= 120000 && row.queryMs <= row.elapsedMs + 1);
    assert.match(row.contentSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(new Set(runs.map(row => `${row.chargedBytes}:${row.bodyBytes}:${row.contentSha256}`)).size, 1);
}
export function rowPromotionScreen(natural, allocations) {
  requireRowRuns(natural,'natural'); requireRowRuns(allocations,'allocations');
  const pairs = [[0,1],[3,2],[4,5],[7,6]], ratios = pairs.map(([a,b]) => {
    const before = allocations[a].profile.sampledEstimatedBytes, after = allocations[b].profile.sampledEstimatedBytes;
    assert.ok(Number.isSafeInteger(before) && before > 0 && Number.isSafeInteger(after) && after > 0); return after / before;
  });
  const median = values => { values.sort((a,b) => a-b); return (values[1]+values[2])/2; };
  const elapsedRatio = median(natural.filter(row => row.mode === 'array').map(row => row.elapsedMs)) /
    median(natural.filter(row => row.mode === 'object').map(row => row.elapsedMs));
  assert.ok(Number.isFinite(elapsedRatio));
  return { allocationRatios: ratios, naturalElapsedRatio: elapsedRatio,
    promising: ratios.every(value => value <= 0.9) && elapsedRatio <= 1.05, productionAuthorized: false };
}
