/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { reviewSourceScope } from '../services/sourceScopeReview.mjs';
import { readSourceIdentityIssues } from '../services/sourceIdentityIssues.mjs';

const row = () => ({ as_of: '2026-10-10T12:00:00Z', total: 1, retry_wait: 0, retry_due: 0,
  source_review: 0, not_recorded: 1, covered_libraries: 1, active_libraries: 1,
  items: [{ libraryId: 1, libraryName: 'Fixture', mediaServerId: 2, externalId: 'private-source',
    title: 'Fixture', mediaType: 'tv', issue: 'conflicting_provider_ids', providerFields: ['tvdb_id'],
    sourceVersion: 'a'.repeat(64) }] });
const body = () => ({ offset: 0, sourceVersion: 'a'.repeat(64), scope: { kind: 'whole_work', tmdbId: 10 } });
function setup(data = row()) {
  const db = { query: jest.fn(async sql => ({ rows: sql.startsWith('SELECT role')
    ? [{ role: 'admin', is_active: true }] : [data] })) };
  return { db, key: () => readSourceIdentityIssues(db).then(page => page.items[0].key) };
}
test('binds a canonical draft to current stored evidence without writes, IDs or credentials', async () => {
  const { db, key } = setup(); const sourceKey = await key(); db.query.mockClear();
  const result = await reviewSourceScope(db, 7, sourceKey, body());
  expect(result).toMatchObject({ status: 'valid_draft', sourceKey, sourceVersion: 'a'.repeat(64),
    canApply: false, persisted: false, verification: 'structure_only',
    parentConflict: { issue: 'conflicting_provider_ids', providerFields: ['tvdb_id'] },
    backfill: { eligible: false, excludedScope: 'all' } });
  expect(result.draftFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(db.query).toHaveBeenCalledTimes(3);
  expect(db.query.mock.calls.every(([sql]) => !/\b(UPDATE|INSERT|DELETE)\b/.test(sql))).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/private-source|mediaServerId|api_key/);
});
test('preserves explicit partial season scope and all exclusions', async () => {
  const { db, key } = setup(); const input = body();
  input.scope = { kind: 'seasons', coverage: 'partial', sourceSeasonNumbers: [2, 0, 1],
    mappings: [{ sourceSeason: 2, tmdbSeriesId: 20, tmdbSeason: 1 }, { sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 }] };
  const result = await reviewSourceScope(db, 7, await key(), input);
  expect(result.scope.sourceSeasonNumbers).toEqual([0, 1, 2]);
  expect(result.scope.mappings.map(edge => edge.tmdbSeriesId)).toEqual([10, 20]);
  expect(result.backfill.eligible).toBe(false);
});
test.each([
  input => { input.confirmed = true; }, input => { input.offset = -1; }, input => { input.offset = '0'; },
  input => { input.sourceVersion = 'bad'; }, input => { input.scope = { text: 'x'.repeat(32768) }; },
])('rejects invalid envelopes before reading', async change => {
  const { db } = setup(); const input = body(); change(input);
  await expect(reviewSourceScope(db, 7, 'b'.repeat(64), input)).rejects.toMatchObject({ statusCode: 400 });
  expect(db.query).not.toHaveBeenCalled();
});
test.each(['user', 'disabled', 'revoked'])('rejects %s administrators', async state => {
  const { db, key } = setup(); const sourceKey = await key(); let actorReads = 0;
  db.query.mockImplementation(async sql => {
    if (!sql.startsWith('SELECT role')) return { rows: [row()] };
    actorReads++;
    return { rows: [{ role: state === 'user' || (state === 'revoked' && actorReads === 2) ? 'user' : 'admin', is_active: state !== 'disabled' }] };
  });
  await expect(reviewSourceScope(db, 7, sourceKey, body())).rejects.toMatchObject({ statusCode: 403 });
});
test.each(['key', 'revision', 'kind', 'absent'])('rejects changed %s evidence', async field => {
  const data = row(); const { db, key } = setup(data); const sourceKey = await key();
  if (field === 'revision') data.items[0].sourceVersion = 'c'.repeat(64);
  if (field === 'kind') data.items[0].issue = 'invalid_provider_ids';
  if (field === 'absent') data.items = [];
  await expect(reviewSourceScope(db, 7, field === 'key' ? 'b'.repeat(64) : sourceKey, body())).rejects.toMatchObject({ statusCode: 409 });
});
test('rejects malformed scope, unknown media type and forged verification claims', async () => {
  const { db, key } = setup(); const sourceKey = await key();
  for (const scope of [null, {}, { kind: 'whole_work', tmdbId: 0 }, { kind: 'whole_work', tmdbId: 10, verified: true }]) {
    await expect(reviewSourceScope(db, 7, sourceKey, { ...body(), scope })).rejects.toMatchObject({ statusCode: 400 });
  }
});
test('copies caller scope before any asynchronous authorization read', async () => {
  const { db, key } = setup(); const sourceKey = await key(); const input = body();
  const pending = reviewSourceScope(db, 7, sourceKey, input); input.scope.tmdbId = 999;
  expect((await pending).scope.tmdbId).toBe(10);
});
