/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { recordClassificationCorrection, pruneClassificationCorrectionOutcomes } from '../../services/classificationCorrectionWriter.mjs';
import { inventorySourceDescriptionKey } from '../../services/inventorySourceDescriptionIdentity.mjs';
import { inventoryOutcomeIdentity, prepareInventoryOutcomeLabels } from '../../services/inventoryOutcomeLabels.mjs';
import { persistDiscordCorrection } from '../../services/discordCorrectionPersistence.mjs';

const classification = { id: 1, tmdb_id: 7, media_type: 'movie', library_id: 2 };
const params = overrides => ({ classification, originalLibraryId: 2, destinationLibraryId: 3, correctedBy: 'user', ...overrides });

test.each(['movie', 'tv'])('captures typed %s correction in one bound statement without copying metadata', async media_type => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 99 }] }) };
  expect(await recordClassificationCorrection(client, params({ classification: { ...classification, media_type,
    metadata: { token: 'SECRET' }, title: 'PRIVATE' } }))).toEqual({ id: 99 });
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls[0][1]).toEqual([1, 2, 3, 'user', media_type, `${media_type}:7`, null]);
  expect(client.query.mock.calls[0][0]).toContain('INSERT INTO classification_correction_outcomes');
  expect(JSON.stringify(client.query.mock.calls)).not.toMatch(/SECRET|PRIVATE/);
});

test.each([null, 0, -1, 'not-an-id', 2147483648])('does not guess an identity from invalid TMDB id %s', async tmdb_id => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 99 }] }) };
  await recordClassificationCorrection(client, params({ classification: { ...classification, tmdb_id } }));
  expect(client.query.mock.calls.at(-1)[1][5]).toBeNull();
});

test('source-only capture uses scoped inventory identity and consistency checks', async () => {
  const source = { library_id: 2, media_server_id: 8, external_id: 'provider-item', media_type: 'movie', tmdb_id: null };
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [source] }).mockResolvedValueOnce({ rows: [{ id: 99 }] }) };
  await recordClassificationCorrection(client, params({ classification: { ...classification, tmdb_id: null,
    method: 'source_library', title: 'PRIVATE', year: 2020, metadata: { itemId: 4, source_library_id: 2 } } }));
  expect(client.query.mock.calls[0][1]).toEqual([4, 2, 'movie', 'PRIVATE', 2020]);
  expect(client.query.mock.calls[0][0]).toMatch(/year IS NOT DISTINCT FROM/);
  expect(client.query.mock.calls[1][1][5]).toBe(inventorySourceDescriptionKey(source));
  expect(JSON.stringify(client.query.mock.calls[1])).not.toContain('provider-item');
});

test.each([{ rows: [] }, { rows: [{ media_type: 'movie', library_id: 2 }] }])('missing or malformed source anchor never becomes a label: %j', async ({ rows }) => {
  const client = { query: jest.fn().mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows: [{ id: 99 }] }) };
  await recordClassificationCorrection(client, params({ classification: { ...classification, tmdb_id: null,
    method: 'source_library', metadata: { itemId: 4, source_library_id: 2 } } }));
  expect(client.query.mock.calls.at(-1)[1][5]).toBeNull();
});

test('receipt failure propagates to the caller transaction, while cleanup is bounded', async () => {
  const client = { query: jest.fn().mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce({ rowCount: 4 }) };
  await expect(recordClassificationCorrection(client, params())).rejects.toThrow('write failed');
  expect(await pruneClassificationCorrectionOutcomes(client)).toBe(4);
  expect(client.query.mock.calls[1][0]).toMatch(/LIMIT 1000/);
  expect(client.query.mock.calls[1][0]).toMatch(/FOR UPDATE SKIP LOCKED/);
});

test('source labels are scoped and contradictory explicit choices are excluded', () => {
  const key = `source:${'a'.repeat(64)}`;
  const row = { media_type: 'tv', tmdb_id: null, identity_key: key, origin: 'manual_correction',
    selected_library_id: 2, was_correction: true };
  const docs = [{ key, libraryIds: [1] }], libs = [{ id: 2, media_type: 'tv' }, { id: 3, media_type: 'tv' }];
  expect(prepareInventoryOutcomeLabels([row], docs, libs).labels.get(key)).toEqual({ libraryId: 2, kind: 'correction' });
  expect(prepareInventoryOutcomeLabels([row, { ...row, selected_library_id: 3 }], docs, libs).coverage.conflictingIdentities).toBe(1);
  for (const malformed of [{ ...row, origin: 'feedback' }, { ...row, tmdb_id: 8 }, { ...row, identity_key: 'tv:08' },
    { ...row, identity_key: 'movie:8', tmdb_id: 8 }]) expect(inventoryOutcomeIdentity(malformed)).toBeNull();
});

test.each([['movie', false], ['tv', true], ['music', true]])('Discord rejects incompatible destinations %s/%s before writing', async (media_type, is_active) => {
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [classification] })
    .mockResolvedValueOnce({ rows: [{ name: 'Destination', media_type, is_active }] }) };
  const result = await persistDiscordCorrection({ withTransaction: callback => callback(client) }, {},
    { classificationId: 1, newLibraryId: 3, actor: 'user' });
  expect(result.message).toMatch(/inactive|incompatible/);
  expect(client.query).toHaveBeenCalledTimes(2);
});
