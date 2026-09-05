/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { captureEnrichmentSource, encodeEnrichmentSource } from '../services/queueEnrichmentSourceGuard.mjs';
import { persistEnrichmentMetadata } from '../services/queueEnrichmentPersistence.mjs';
import { persistResolvedIdentity } from '../services/mediaResolvedIdentityPersistence.mjs';
import { buildQueueClassificationHistoryInsertQuery } from '../services/queueClassificationHistoryQueries.mjs';

const row = () => ({ media_server_id: 1, external_id: 'key', library_id: 2, media_type: 'tv',
  title: 'Source', year: 2001, imdb_id: null, tvdb_id: 7 });
const payload = () => ({ itemId: 1, title: 'Source', year: 2001, source_library_id: 2,
  media: { media_type: 'tv' }, source_identity_snapshot: row() });
const identity = { tmdbId: null, libraryId: 2, mediaType: 'tv', title: 'Source' };

test('captures only source fields and keeps nulls independent of caller mutation', () => {
  const current = { ...row(), content_rating: 'PG', metadata: { unrelated: true } };
  const captured = captureEnrichmentSource(current);
  current.title = 'Changed'; current.metadata.unrelated = false;
  expect(captured).toEqual(row());
  expect(captureEnrichmentSource({ media_type: 'tv' }).year).toBeNull();
  expect(JSON.parse(encodeEnrichmentSource({ ...captured, injected: 'SELECT 1' }, 'tv', 2))).toEqual(row());
});

test.each([null, undefined, [], 'invalid', {}, { ...row(), year: undefined },
  { ...row(), title: {} }, { ...row(), year: Infinity }, { ...row(), year: NaN },
  { ...row(), media_type: 'movie' }])('rejects invalid source snapshots without a database call: %j', async snapshot => {
  const query = jest.fn();
  expect(encodeEnrichmentSource(snapshot, 'tv')).toBeNull();
  expect(await persistResolvedIdentity(query, 1, 42, 'tv', snapshot)).toEqual({ rowCount: 0 });
  expect(await persistEnrichmentMetadata(query, { ...payload(), source_identity_snapshot: snapshot }, null, {}, false))
    .toEqual({ rowCount: 0 });
  expect(query).not.toHaveBeenCalled();
});

test('rejects a mismatched library or missing final TMDb state', async () => {
  expect(encodeEnrichmentSource(row(), 'tv', 3)).toBeNull();
  const query = jest.fn();
  expect(await persistEnrichmentMetadata(query, payload(), undefined, {}, false)).toEqual({ rowCount: 0 });
  expect(query).not.toHaveBeenCalled();
});

test('captures metadata and guard values before yielding to persistence', async () => {
  const input = payload();
  const data = { inventory_tmdb: { version: 1, tmdb_id: 42 } };
  const query = jest.fn().mockImplementation(async () => {
    input.source_identity_snapshot.title = 'Changed'; data.inventory_tmdb.tmdb_id = 99;
    return { rowCount: 1 };
  });
  await persistEnrichmentMetadata(query, input, 42, data, true);
  const values = query.mock.calls[0][1];
  expect(JSON.parse(values[0])).toEqual({ inventory_tmdb: { version: 1, tmdb_id: 42 } });
  expect(JSON.parse(values[7])).toEqual(row());
});

test.each([{ itemId: 0 }, { itemId: '1; SELECT 1' }, { source_identity_snapshot: null },
  { source_identity_snapshot: { ...row(), title: 'Different' } },
  { source_identity_snapshot: { ...row(), year: 2002 } },
  { source_identity_snapshot: { ...row(), library_id: 3 } }])('source-item history cannot use unrelated evidence: %j', patch => {
  expect(buildQueueClassificationHistoryInsertQuery(identity, { ...payload(), ...patch }, 'Library', {})).toBeNull();
});

test('guards history insertion while removing private snapshot fields from history metadata', () => {
  const input = payload();
  const statement = buildQueueClassificationHistoryInsertQuery(identity, input, 'Library', {});
  expect(statement.text).toContain('FOR SHARE');
  expect(JSON.parse(statement.values[9]).source_identity_snapshot).toBeUndefined();
  expect(JSON.parse(statement.values[16])).toEqual(row());
  expect(input.source_identity_snapshot).toEqual(row());
});
