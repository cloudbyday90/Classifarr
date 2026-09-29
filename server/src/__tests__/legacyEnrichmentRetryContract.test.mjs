/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { legacyRetryRequest, projectLegacyRetries } from '../services/legacyEnrichmentRetryContract.mjs';
const snapshot = () => ({ library: { id: 1, name: 'Library', is_active: true, media_type: 'movie' }, hasMore: false,
  rows: [{ id: 2, media_item_id: 3, title: 'Synthetic', media_type: 'movie', attempts: 1, max_attempts: 3, enrichment_type: 'omdb', source_revision: 'private' }] });
test('review binds actor and source versions and projects only bounded display fields', () => {
  const input = snapshot(), preview = projectLegacyRetries(input, 7);
  expect(preview).toMatchObject({ canRecover: true, items: [{ outcome: 'pending' }] });
  expect(JSON.stringify(preview)).not.toContain('private');
  expect(projectLegacyRetries(input, 8).revision).not.toBe(preview.revision);
  input.rows[0].source_revision = 'changed';
  expect(projectLegacyRetries(input, 7).revision).not.toBe(preview.revision);
  input.rows[0].attempts = 3;
  expect(projectLegacyRetries(input, 7).items[0].outcome).toBe('failed');
  input.library.is_active = false;
  expect(projectLegacyRetries(input, 7).canRecover).toBe(true);
  input.library.archived_at = 'synthetic';
  expect(projectLegacyRetries(input, 7).reason).toBe('library_archived');
  input.library.media_type = 'artist';
  expect(projectLegacyRetries(input, 7).reason).toBe('unsupported_library');
  expect(projectLegacyRetries({ ...snapshot(), rows: [] }, 7).reason).toBe('not_needed');
});
test('confirmation requires exact body, true attestation, IDs and strong If-Match', () => {
  const body = { requestId: randomUUID(), workersStopped: true }, revision = projectLegacyRetries(snapshot(), 7).revision;
  expect(legacyRetryRequest('7', '1', body, revision)).toMatchObject({ actorId: 7, libraryId: 1, revision });
  for (const value of [false, 'true', 1, undefined, null]) expect(() => legacyRetryRequest(7, 1, { ...body, workersStopped: value }, revision)).toThrow();
  for (const value of [null, {}, [], { ...body, force: true }]) expect(() => legacyRetryRequest(7, 1, value, revision)).toThrow();
  expect(() => legacyRetryRequest(7, 1, body)).toThrow(expect.objectContaining({ status: 428 }));
  for (const value of ['*', 'W/' + revision, revision + ', ' + revision, 1]) expect(() => legacyRetryRequest(7, 1, body, value)).toThrow();
  expect(() => legacyRetryRequest(7, -1, body, revision)).toThrow();
  expect(() => legacyRetryRequest(7, 1, { ...body, requestId: 'unsafe' }, revision)).toThrow();
});
