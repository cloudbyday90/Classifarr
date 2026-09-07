/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { sourceIdentityDiagnostics } from '../services/mediaSyncIdentityDiagnostics.mjs';
import { parsePlexGuids } from '../services/mediaServers/shared/providerIds.mjs';
import { persistSyncedMediaItem } from '../services/mediaSyncItemPersistence.mjs';

test.each(['tmdb', 'imdb', 'tvdb'])('explains a conflicting %s identity without choosing a winner', async provider => {
  const id = value => ({ id: `${provider}://${provider === 'imdb' ? 'tt' : ''}${value}` });
  const incoming = { external_id: 'private-source', media_type: 'movie', title: 'Private title',
    ...parsePlexGuids([id(123), id(456)]) };
  const details = sourceIdentityDiagnostics(1, 2, incoming);
  expect(details).toEqual({ identityIssue: 'conflicting_provider_ids', providerFields: [`${provider}_id`],
    mediaServerId: 1, libraryId: 2, sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(JSON.stringify(details)).not.toMatch(/private|:\/\//);
  expect(incoming).toMatchObject({ tmdb_id: null, imdb_id: null, tvdb_id: null });
  const query = jest.fn(), analyze = jest.fn();
  expect(await persistSyncedMediaItem(1, 2, incoming, { query, analyze })).toBe('invalid_source_identity');
  expect(query).not.toHaveBeenCalled(); expect(analyze).not.toHaveBeenCalled();
  expect(sourceIdentityDiagnostics(1, 3, incoming).sourceFingerprint).toBe(details.sourceFingerprint);
  expect(sourceIdentityDiagnostics(2, 2, incoming).sourceFingerprint).not.toBe(details.sourceFingerprint);
});

test.each([
  [0, { external_id: 'source', media_type: 'movie' }, 'invalid_media_server_id'],
  [1, { external_id: 'source', media_type: 'private' }, 'invalid_media_type'],
  [1, { external_id: 123, media_type: 'movie' }, 'invalid_external_id'],
  [1, { external_id: 'source', media_type: 'movie', tmdb_id: 'malformed' }, 'invalid_provider_ids'],
])('reports fixed validation categories: %#', (serverId, incoming, issue) => {
  expect(sourceIdentityDiagnostics(serverId, 2, incoming).identityIssue).toBe(issue);
});

test('does not forward forged diagnostic fields or unbounded identifiers', () => {
  const details = sourceIdentityDiagnostics(1, 'private-library', { external_id: 'x'.repeat(501), media_type: 'movie',
    provider_identity_invalid: true, provider_identity_issue: 'private payload', provider_identity_field: 'private field' });
  expect(details).toMatchObject({ identityIssue: 'invalid_provider_ids', providerFields: [], libraryId: null, sourceFingerprint: null });
  expect(JSON.stringify(details)).not.toContain('private');
});
