/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';

const cases = Object.freeze([
  { type: 'movie', title: 'Isolation movie', externalId: 'isolation-classification-movie' },
  { type: 'tv', title: 'Isolation series', externalId: 'isolation-classification-tv' },
]);

export async function classifyFixture(database, classificationService) {
  const { rows: [state] } = await database.query(`SELECT
    (SELECT count(*)::int FROM libraries) AS libraries,
    (SELECT count(*)::int FROM classification_history) AS history,
    EXISTS (SELECT 1 FROM ai_provider_config WHERE rag_enabled = true) AS embeddings`);
  assert.deepEqual(state, { libraries: 0, history: 0, embeddings: false }, 'classification_fixture_requires_empty_state');
  for (const item of cases) {
    const { rows: [library] } = await database.query(`INSERT INTO libraries
      (external_id, name, media_type) VALUES ($1, $2, $3) RETURNING id, name`,
    [item.externalId, item.title, item.type]);
    const result = await classificationService.classify({
      media_type: item.type, title: item.title, year: 2026,
      overview: 'Synthetic isolated classification with complete metadata.', genres: ['Drama'],
      source_library_id: library.id, source_library_name: library.name,
    });
    assert.equal(result.success, true, 'classification_fixture_failed');
    assert.equal(result.method, 'source_library', 'classification_fixture_wrong_method');
    assert.equal(result.routingOutcome.shouldRoute, false, 'classification_fixture_unexpected_route');
  }
}

export async function readClassificationFixture(database) {
  const { rows } = await database.query(`SELECT ch.id::text, ch.title, ch.media_type,
    ch.method, ch.status, ch.confidence::int, l.external_id,
    ch.metadata->'classification_details'->>'routing' AS routing
    FROM classification_history ch JOIN libraries l ON l.id = ch.library_id
    WHERE l.external_id = ANY($1::text[]) ORDER BY ch.media_type, ch.id LIMIT 3`,
  [cases.map(item => item.externalId)]);
  assert(rows.length <= cases.length, 'classification_fixture_duplicate_results');
  if (rows.length < cases.length || rows.some(row => row.routing === null)) return null;
  rows.forEach((row, index) => {
    const item = cases[index];
    assert.deepEqual({ ...row, id: undefined }, {
      id: undefined, title: item.title, media_type: item.type, method: 'source_library',
      status: 'completed', confidence: 100, external_id: item.externalId, routing: 'threshold_not_met',
    }, 'classification_fixture_incorrect_persistence');
    assert.match(row.id, /^[1-9]\d*$/);
  });
  return rows;
}

export async function waitForClassificationFixture(database, { timeout = 30_000, now = Date.now, wait = sleep } = {}) {
  const deadline = now() + timeout;
  while (now() < deadline) {
    const result = await readClassificationFixture(database);
    if (result) return result;
    await wait(200);
  }
  throw new Error('classification_fixture_timeout');
}
