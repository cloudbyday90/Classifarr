/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventorySemanticSampler, validateInventorySampleOptions } from '../../services/inventorySemanticSampler.mjs';
import { INVENTORY_SEMANTIC_SAMPLE_SQL } from '../../services/inventorySemanticSampleQuery.mjs';

function inventoryRow(id, overview = 'Private description') {
  return { media_type: 'movie', tmdb_id: id, title: 'Private title', study_stratum: 'documentary', metadata: { summary: overview } };
}

function neighbor(libraryId, overrides = {}) {
  return {
    library_id: libraryId, library_name: 'Private library', query_embedding_available: true,
    observed_membership: libraryId === 1, tmdb_id: 800 + libraryId, title: 'Private neighbor',
    overview: 'Private plot', similarity: libraryId === 1 ? 0.9 : 0.6,
    has_authorized_outcome: libraryId === 1, ...overrides,
  };
}

function harness({ frame = [inventoryRow(1)], rows = [neighbor(1), neighbor(2)], libraryCount = 2 } = {}) {
  const query = jest.fn(async sql => {
    if (sql.startsWith('SELECT id FROM libraries')) return { rows: Array.from({ length: libraryCount }, (_, i) => ({ id: i + 1 })) };
    if (sql.includes('WITH canonical_items')) return { rows: frame };
    if (sql === INVENTORY_SEMANTIC_SAMPLE_SQL) return { rows };
    return { rows: [] };
  });
  const withTransaction = jest.fn(fn => fn({ query }));
  return { query, withTransaction, sampler: createInventorySemanticSampler({ withTransaction }) };
}

test('samples without policy declarations, preserving private descriptions only in memory', async () => {
  const { sampler, query } = harness();
  const { cases, report } = await sampler.sample();
  expect(cases[0].item.metadata.overview).toBe('Private description');
  expect(cases[0].libraries[0].neighbors[0].item.metadata.overview).toBe('Private plot');
  expect(report.summary).toMatchObject({
    sampled: 1, withCrossLibraryComparison: 1, observedAgreement: 1,
    neighborsWithAuthorizedOutcome: 1, independentlyLabeled: 0, unlabeled: 1, accuracy: null,
  });
  expect(JSON.stringify(report)).not.toMatch(/Private|tmdb|library_id|800/);
  expect(query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  expect(query.mock.calls.slice(1, 5).map(call => call[0])).toEqual([
    "SET LOCAL statement_timeout = '15s'", "SET LOCAL lock_timeout = '2s'",
    "SET LOCAL idle_in_transaction_session_timeout = '20s'", "SET LOCAL transaction_timeout = '90s'",
  ]);
});

test('bounds the sample before retrieval and excludes the entire unchanged cohort each time', async () => {
  const { sampler, query } = harness({ frame: [inventoryRow(1), inventoryRow(2), inventoryRow(3)] });
  const { report } = await sampler.sample({ size: 2 });
  const calls = query.mock.calls.filter(call => call[0] === INVENTORY_SEMANTIC_SAMPLE_SQL);
  expect(report.summary.sampled).toBe(2);
  expect(calls).toHaveLength(2);
  for (const [, parameters] of calls) expect(parameters.slice(3)).toEqual([['movie', 'movie'], [1, 2], 30]);
});

test('missing embeddings and descriptions stay in the denominator without replacement', async () => {
  const { sampler } = harness({
    frame: [inventoryRow(1, '')],
    rows: [neighbor(1, { tmdb_id: null, query_embedding_available: false })],
  });
  const { report } = await sampler.sample();
  expect(report.summary).toMatchObject({ sampled: 1, withDescription: 0, withStoredEmbedding: 0, withNeighbors: 0, unlabeled: 1 });
});

test.each([
  ['tie', [neighbor(1), neighbor(2, { similarity: 0.9 })], { tiedComparisons: 1, observedDisagreement: 0 }],
  ['disagreement', [neighbor(1), neighbor(2, { similarity: 0.99 })], { observedDisagreement: 1, observedAgreement: 0 }],
  ['multiple memberships', [neighbor(1), neighbor(2, { similarity: 0.99, observed_membership: true })], { observedAgreement: 1 }],
  ['no observed active membership', [neighbor(1, { observed_membership: false }), neighbor(2)], { withObservedMembership: 0, observedDisagreement: 0, observedAgreement: 0 }],
  ['one represented library', [neighbor(1)], { withNeighbors: 1, withCrossLibraryComparison: 0, observedAgreement: 0 }],
  ['unrepresented observed library', [neighbor(1, { tmdb_id: null }), neighbor(2), neighbor(3, { similarity: 0.5 })], { withCrossLibraryComparison: 1, withScoredObservedLibrary: 0, observedDisagreement: 0, observedAgreement: 0 }],
])('reports %s without pretending to measure correctness', async (_name, rows, counts) => {
  const { report } = await harness({ rows }).sampler.sample();
  expect(report.summary).toMatchObject(counts);
  expect(report.summary.accuracy).toBeNull();
});

test.each([{}, { frame: [], libraryCount: 0 }])('empty inventory returns an explicit empty result', async options => {
  const { report } = await harness({ ...options, frame: [] }).sampler.sample();
  expect(report.status).toBe('empty_inventory');
  expect(report.summary.sampled).toBe(0);
});

test.each([{ size: 0 }, { size: 33 }, { size: 2.5 }, { seed: 'short' }, { seed: "a'.repeat(200)--" }, { seed: 'x'.repeat(129) }])('invalid options are rejected before database access: %j', async options => {
  const { sampler, withTransaction } = harness();
  await expect(sampler.sample(options)).rejects.toThrow('invalid_inventory_semantic_sample_options');
  expect(withTransaction).not.toHaveBeenCalled();
});

test('validates dependencies and bounds active libraries before inventory retrieval', async () => {
  expect(() => createInventorySemanticSampler({})).toThrow('inventory_sample_transaction_required');
  expect(validateInventorySampleOptions({ size: 32 }).size).toBe(32);
  const { sampler, query } = harness({ libraryCount: 65 });
  await expect(sampler.sample()).rejects.toThrow('inventory_sample_library_limit_exceeded');
  expect(query.mock.calls.some(call => call[0].includes('WITH canonical_items'))).toBe(false);
});

test('propagates query failure to the transaction owner without returning partial success', async () => {
  const { sampler, query } = harness();
  query.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(sampler.sample()).rejects.toThrow('database unavailable');
});

test.each([NaN, Infinity, 1.1, -1.1])('rejects malformed cosine similarity %s', async similarity => {
  await expect(harness({ rows: [neighbor(1, { similarity })] }).sampler.sample()).rejects.toThrow('invalid_inventory_neighbor_similarity');
});
