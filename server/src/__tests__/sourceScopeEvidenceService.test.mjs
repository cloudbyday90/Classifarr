/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { createSourceScopeEvidenceService } from '../services/sourceScopeEvidenceService.mjs';

const key = createHash('sha256').update(JSON.stringify([1, 2, 'private-source'])).digest('hex');
const input = () => ({ offset: 0, sourceVersion: 'a'.repeat(64), scope: { kind: 'whole_work', tmdbId: 10 } });
function setup(includeIdentityAudit = false) {
  const target = { library_id: 1, media_server_id: 2, external_id: 'private-source', media_type: 'movie',
    is_active: true, server_type: 'plex', library_external_id: 'private-library', url: 'http://fixture.invalid', api_key: 'secret',
    catalog_config: { active: true, key: 'catalog-secret' }, source_digest: 'b'.repeat(64) };
  const item = { libraryId: 1, mediaServerId: 2, externalId: 'private-source', title: 'Fixture', mediaType: 'movie',
    issue: 'conflicting_provider_ids', providerFields: ['tvdb_id'], sourceVersion: 'a'.repeat(64) };
  const db = { query: jest.fn(async sql => ({ rows: sql.startsWith('SELECT role') ? [{ role: 'admin', is_active: true }]
    : sql.includes('AS observation_revision') ? [{ ...target }]
      : [{ as_of: '2026-10-10T12:00:00Z', total: 1, retry_wait: 0, retry_due: 0,
        source_review: 0, not_recorded: 1, covered_libraries: 1, active_libraries: 1, items: [item] }] })) };
  const source = { identity: { mediaType: 'movie', snapshotDigest: 'b'.repeat(64),
    providerIds: { tmdb_id: [10], tvdb_id: [], imdb_id: ['tt10'] } }, digest: 'source' };
  const adapter = { getLibraryItemLayout: jest.fn(async () => structuredClone(source)) };
  const provider = { getIdentityDetails: jest.fn(async () => ({ id: 10, title: 'Fixture' })), recheck: jest.fn(async () => {}),
    findIdentityByExternalId: jest.fn(async () => ({ movie_results: [{ id: 10 }], tv_results: [],
      tv_season_results: [], tv_episode_results: [], person_results: [] })) };
  const lease = new AbortController();
  const deps = { db, includeIdentityAudit, withLock: jest.fn(async callback => { await callback({ signal: lease.signal }); return true; }),
    getMediaServerService: jest.fn(() => adapter), createCatalogProvider: jest.fn(async () => provider) };
  return { inspect: createSourceScopeEvidenceService(deps), deps, target, item, adapter, provider, db, source, lease };
}
test('rechecks both providers and configuration without writes, leaking secrets or enabling backfill', async () => {
  const s = setup(); const result = await s.inspect(7, key, input());
  expect(result).toMatchObject({ version: 'source_scope_evidence.v1', verification: 'typed_catalog_membership', crossProviderVerified: false,
    canApply: false, persisted: false, comparison: { unit: 'movie', total: 1, matched: 1, exclusions: [] },
    backfill: { eligible: false, excludedScope: 'all', reason: 'mapping_not_approved' } });
  expect(result.catalogWorks).toEqual([{ tmdbId: 10, mediaType: 'movie', title: 'Fixture', releaseDate: null }]);
  expect(result.reference).toMatch(/^[a-f0-9-]{36}$/);
  expect(s.adapter.getLibraryItemLayout).toHaveBeenCalledTimes(2);
  expect(s.provider.getIdentityDetails).toHaveBeenCalledTimes(2);
  expect(s.provider.recheck).toHaveBeenCalledTimes(1);
  expect(s.db.query.mock.calls.every(([sql]) => !/\b(UPDATE|INSERT|DELETE)\b/.test(sql))).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/private-source|private-library|secret|fixture.invalid/);
});

test('combined audit repeats parent reads, binds a separate fingerprint, and preserves approval evidence', async () => {
  const s = setup(true), result = await s.inspect(7, key, input());
  expect(result.combinedAudit).toMatchObject({ version: 'source_combined_evidence.v1', status: 'catalog_and_scope_agreement',
    candidateTmdbId: 10, parentBlockers: [], scopeComplete: true, proposalMatchesIdentity: true,
    crossProviderVerified: false, automaticRecoveryEligible: false });
  expect(result.combinedAudit.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(s.provider.findIdentityByExternalId).toHaveBeenCalledTimes(2);
  expect(s.provider.getIdentityDetails).toHaveBeenCalledTimes(4);
  expect(result.evidenceFingerprint).toBe((await setup().inspect(7, key, input())).evidenceFingerprint);
  expect(s.db.query.mock.calls.every(([sql]) => !/\b(UPDATE|INSERT|DELETE)\b/.test(sql))).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/private-source|private-library|secret|fixture.invalid|tt10/);
});

test.each(['parent', 'retained', 'invalid', 'lease', 'config', 'actor', 'timeout'])('combined audit fails closed on %s change', async mode => {
  const s = setup(true), deadline = new AbortController();
  const timer = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  const original = s.provider.findIdentityByExternalId.getMockImplementation();
  let reads = 0;
  s.provider.findIdentityByExternalId.mockImplementation(async () => {
    reads++;
    if (mode === 'lease') s.lease.abort();
    if (mode === 'timeout') deadline.abort();
    if (mode === 'config') s.target.api_key = 'rotated';
    if (mode === 'actor') s.item.sourceVersion = 'c'.repeat(64);
    const data = await original();
    if (mode === 'parent' && reads === 2) data.person_results = [{ id: 77 }];
    if (mode === 'invalid') data.movie_results = 'secret';
    return data;
  });
  if (mode === 'retained') s.source.identity.snapshotDigest = 'c'.repeat(64);
  try {
    await expect(s.inspect(7, key, input())).rejects.toMatchObject({ statusCode: ['parent', 'retained', 'config', 'actor'].includes(mode) ? 409 : 503 });
    if (mode === 'retained') expect(s.provider.getIdentityDetails).not.toHaveBeenCalled();
  } finally { timer.mockRestore(); }
});

test('a commit callback never consumes the diagnostic even when the read-only flag is supplied', async () => {
  const s = setup(true), onVerified = jest.fn(async ({ result }) => result);
  const result = await createSourceScopeEvidenceService({ ...s.deps, onVerified })(7, key, input());
  expect(result.combinedAudit).toBeUndefined();
  expect(s.provider.findIdentityByExternalId).not.toHaveBeenCalled();
  expect(onVerified).toHaveBeenCalledTimes(1);
});
test.each(['invalid', 'stale', 'forged'])('rejects %s requests before lock and HTTP', async mode => {
  const s = setup(), body = input();
  if (mode === 'invalid') body.scope.tmdbId = 0;
  if (mode === 'stale') body.sourceVersion = 'b'.repeat(64);
  if (mode === 'forged') body.canApply = true;
  await expect(s.inspect(7, key, body)).rejects.toMatchObject({ statusCode: mode === 'stale' ? 409 : 400 });
  expect(s.deps.withLock).not.toHaveBeenCalled(); expect(s.adapter.getLibraryItemLayout).not.toHaveBeenCalled();
});
test.each(['source', 'catalog', 'config', 'actor', 'stored'])('rejects in-flight %s drift', async field => {
  const s = setup();
  if (field === 'source') s.adapter.getLibraryItemLayout.mockResolvedValueOnce(s.source).mockResolvedValue({ ...s.source, digest: 'changed' });
  if (field === 'catalog') s.provider.getIdentityDetails.mockResolvedValueOnce({ id: 10, title: 'Before' }).mockResolvedValue({ id: 10, title: 'After' });
  if (field === 'config') s.provider.getIdentityDetails.mockImplementation(async () => { s.target.api_key = 'rotated'; return { id: 10, title: 'Fixture' }; });
  if (field === 'stored') s.provider.recheck.mockImplementation(async () => { s.item.sourceVersion = 'b'.repeat(64); });
  if (field === 'actor') s.provider.recheck.mockImplementation(async () => {
    const original = s.db.query.getMockImplementation();
    s.db.query.mockImplementation(sql => sql.startsWith('SELECT role') ? { rows: [{ role: 'user', is_active: true }] } : original(sql));
  });
  await expect(s.inspect(7, key, input())).rejects.toMatchObject({ statusCode: field === 'actor' ? 403 : 409 });
});
test.each(['busy', 'cancel', 'lease', 'unknown', 'absent', 'disabled', 'adapter', 'type'])('fails closed on %s', async failure => {
  const s = setup(), controller = new AbortController();
  if (failure === 'busy') s.deps.withLock.mockResolvedValue(false);
  if (failure === 'cancel') controller.abort();
  if (failure === 'lease') s.provider.getIdentityDetails.mockImplementation(async () => { s.lease.abort(); return { id: 10, title: 'Fixture' }; });
  if (failure === 'unknown') s.adapter.getLibraryItemLayout.mockRejectedValue(new Error('secret http://fixture.invalid'));
  if (failure === 'absent') s.target.external_id = 'gone';
  if (failure === 'disabled') s.target.is_active = false;
  if (failure === 'adapter') s.deps.getMediaServerService.mockReturnValue({});
  if (failure === 'type') s.source.identity.mediaType = 'tv';
  await expect(s.inspect(7, key, input(), controller.signal)).rejects.toMatchObject({ statusCode: ['absent', 'disabled', 'type'].includes(failure) ? 409 : 503 });
  if (failure === 'unknown') await expect(s.inspect(7, key, input())).rejects.not.toThrow('secret');
  if (failure === 'busy' || failure === 'cancel') expect(s.adapter.getLibraryItemLayout).not.toHaveBeenCalled();
});
test('copies caller fields before the first await', async () => {
  const s = setup(), body = input(); const pending = s.inspect(7, key, body);
  body.offset = 50; body.scope.tmdbId = 999;
  expect((await pending).scope.tmdbId).toBe(10);
  expect(s.db.query.mock.calls.filter(([sql]) => sql.includes('AS observation_revision')).every(([, params]) => params[0] === 0)).toBe(true);
});

test('projects a missing catalog position from repeated validated reads without additional HTTP or authority', async () => {
  const s = setup();
  s.target.media_type = s.item.mediaType = s.source.identity.mediaType = 'tv';
  s.source.seasons = [{ number: 1 }];
  s.source.episodes = [{ season: 1, episode: 2, providerIds: { tmdb_id: [], tvdb_id: [], imdb_id: [] } }];
  s.provider.getIdentityDetails.mockResolvedValue({ id: 10, name: 'Fixture', seasons: [{ id: 50, season_number: 1, episode_count: 0 }] });
  s.provider.getIdentitySeasonDetails = jest.fn(async () => ({ id: 50, season_number: 1, episodes: [] }));
  const result = await s.inspect(7, key, input());
  expect(result.comparison).toMatchObject({ total: 1, matched: 0, exclusions: [{ reason: 'missing_tmdb_episode_id',
    gap: { sourceIds: 'none', catalogPosition: 'absent', target: { tmdbSeriesId: 10, season: 1, episode: 2 } } }] });
  expect(result.backfill.eligible).toBe(false);
  expect(result.canApply).toBe(false);
  expect(s.adapter.getLibraryItemLayout).toHaveBeenCalledTimes(2);
  expect(s.provider.getIdentityDetails).toHaveBeenCalledTimes(2);
  expect(s.provider.getIdentitySeasonDetails).toHaveBeenCalledTimes(2);
  expect(s.provider.findIdentityByExternalId).not.toHaveBeenCalled();
  expect(s.db.query.mock.calls.every(([sql]) => !/\b(UPDATE|INSERT|DELETE)\b/.test(sql))).toBe(true);
});
test('the fixed deadline cancels provider work without accepting its late result', async () => {
  const s = setup(), deadline = new AbortController();
  const timer = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  try {
    s.provider.getIdentityDetails.mockImplementation(async () => { deadline.abort(); return { id: 10, title: 'Fixture' }; });
    await expect(s.inspect(7, key, input())).rejects.toMatchObject({ statusCode: 503, code: 'scope_evidence_timed_out' });
    expect(timer).toHaveBeenCalledWith(90000);
    expect(s.adapter.getLibraryItemLayout).toHaveBeenCalledTimes(1);
  } finally { timer.mockRestore(); }
});
