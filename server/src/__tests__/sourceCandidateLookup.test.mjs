/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { createSourceCandidateLookup } from '../services/sourceCandidateLookup.mjs';
const key = createHash('sha256').update(JSON.stringify([1, 2, 'private-source'])).digest('hex');
const input = () => ({ offset: 0, sourceVersion: 'a'.repeat(64) });
function setup() {
  const target = { library_id: 1, media_server_id: 2, external_id: 'private-source', media_type: 'movie', source_digest: 'b'.repeat(64),
    is_active: true, server_type: 'plex', library_external_id: 'private-library', url: 'http://fixture.invalid', api_key: 'secret', catalog_config: null };
  const item = { libraryId: 1, mediaServerId: 2, externalId: 'private-source', title: 'Fixture', mediaType: 'movie',
    issue: 'conflicting_provider_ids', providerFields: ['tvdb_id'], sourceVersion: 'a'.repeat(64) };
  const actor = { role: 'admin', is_active: true };
  const db = { query: jest.fn(async sql => ({ rows: sql.startsWith('SELECT role') ? [actor]
    : sql.includes('AS observation_revision') ? [{ ...target }]
      : [{ as_of: '2026-10-10T12:00:00Z', total: 1, retry_wait: 0, retry_due: 0, source_review: 1,
        not_recorded: 0, covered_libraries: 1, active_libraries: 1, items: [item] }] })) };
  const source = { mediaType: 'movie', providerIds: { tmdb_id: [10], imdb_id: [], tvdb_id: [] }, snapshotDigest: 'b'.repeat(64) };
  const adapter = { getLibraryItemIdentityEvidence: jest.fn(async () => structuredClone(source)) };
  const provider = { getIdentityDetails: jest.fn(async () => ({ id: 10, title: 'Fixture' })), recheck: jest.fn(async () => {}) };
  const lease = new AbortController();
  const deps = { db, withLock: jest.fn(async work => { await work({ signal: lease.signal }); return true; }),
    getMediaServerService: jest.fn(() => adapter), createCatalogProvider: jest.fn(async () => provider) };
  return { lookup: createSourceCandidateLookup(deps), deps, target, item, actor, db, source, adapter, provider, lease };
}
test('read-only lookup binds fresh source and catalog credentials, not approval', async () => {
  const s = setup(), result = await s.lookup(7, key, input());
  expect(result).toMatchObject({ version: 'source_candidates.v1', canApply: false, persisted: false, sourceKey: key,
    candidates: [{ tmdbId: 10, mediaType: 'movie', title: 'Fixture', lookupIndexes: [0] }] });
  expect(s.adapter.getLibraryItemIdentityEvidence).toHaveBeenCalledTimes(2);
  expect(s.provider.recheck).toHaveBeenCalledTimes(1);
  expect(s.db.query.mock.calls.every(([sql]) => !/\b(UPDATE|INSERT|DELETE)\b/.test(sql))).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/private-source|private-library|secret|fixture.invalid/);
});
test.each(['forged', 'stale', 'offset', 'key', 'role'])('rejects %s before HTTP', async mode => {
  const s = setup(), body = input();
  if (mode === 'forged') body.tmdbId = 10;
  if (mode === 'stale') body.sourceVersion = 'c'.repeat(64);
  if (mode === 'offset') body.offset = -1;
  if (mode === 'role') s.actor.role = 'user';
  await expect(s.lookup(7, mode === 'key' ? '../' : key, body)).rejects.toMatchObject({ statusCode: mode === 'stale' ? 409 : mode === 'role' ? 403 : 400 });
  expect(s.deps.withLock).not.toHaveBeenCalled();
});
test.each(['source', 'config', 'stored', 'actor'])('rejects in-flight %s drift', async mode => {
  const s = setup();
  s.provider.getIdentityDetails.mockImplementation(async () => {
    if (mode === 'source') s.source.providerIds.tmdb_id = [20];
    if (mode === 'config') s.target.api_key = 'rotated';
    if (mode === 'stored') s.item.sourceVersion = 'c'.repeat(64);
    if (mode === 'actor') s.actor.is_active = false;
    return { id: 10, title: 'Fixture' };
  });
  await expect(s.lookup(7, key, input())).rejects.toMatchObject({ statusCode: mode === 'actor' ? 403 : 409 });
});
test.each(['busy', 'cancel', 'lease', 'unknown', 'disabled', 'absent', 'adapter', 'digest'])('fails closed on %s', async mode => {
  const s = setup(), controller = new AbortController();
  if (mode === 'busy') s.deps.withLock.mockResolvedValue(false);
  if (mode === 'cancel') controller.abort();
  if (mode === 'lease') s.lease.abort();
  if (mode === 'unknown') s.adapter.getLibraryItemIdentityEvidence.mockRejectedValue(new Error('private-secret'));
  if (mode === 'disabled') s.target.is_active = false;
  if (mode === 'absent') s.target.external_id = 'gone';
  if (mode === 'adapter') s.deps.getMediaServerService.mockReturnValue({});
  if (mode === 'digest') s.target.source_digest = 'c'.repeat(64);
  await expect(s.lookup(7, key, input(), controller.signal)).rejects.toMatchObject({ statusCode: ['disabled', 'absent', 'digest'].includes(mode) ? 409 : 503 });
  if (mode === 'unknown') await expect(s.lookup(7, key, input())).rejects.not.toThrow('private-secret');
});
test('copies inputs and rejects work after the deadline', async () => {
  const s = setup(), body = input(), pending = s.lookup(7, key, body);
  body.offset = 50; body.sourceVersion = 'f'.repeat(64);
  expect((await pending).sourceVersion).toBe('a'.repeat(64));
  const controller = new AbortController(), timer = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  try {
    s.provider.getIdentityDetails.mockImplementation(async () => { controller.abort(); return { id: 10, title: 'Fixture' }; });
    await expect(s.lookup(7, key, input())).rejects.toMatchObject({ code: 'candidate_timed_out' });
    expect(timer).toHaveBeenCalledWith(60000);
  } finally { timer.mockRestore(); }
});
