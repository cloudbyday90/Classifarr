/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createOwnedCaptureFixture } from '../helpers/ownedCaptureFixture.mjs';
import { sourceIdentityRecoveryEvidence } from '../../services/sourceIdentityRecoveryEvidence.mjs';
import { readSourceIdentityIssues } from '../../services/sourceIdentityIssues.mjs';
import { createSourceScopeEvidenceService } from '../../services/sourceScopeEvidenceService.mjs';
import { createSourceMappingApproval } from '../../services/sourceMappingApproval.mjs';
import { createSourceMappingManagement } from '../../services/sourceMappingManagement.mjs';
import { createSourceMappingRecovery } from '../../services/sourceMappingRecovery.mjs';
import { persistSourceMapping } from '../../services/sourceMappingPersistence.mjs';
import { MEDIA_SYNC_OWNER_LOCK } from '../../services/mediaSyncLockKeys.mjs';
import { buildInventoryDescriptionCorpusSql, prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';

let pool, db, store, actorId, serverId, libraryId, item, layout, provider, deps;
const analyze = async () => ({ analyzed: false });
const scope = kind => kind === 'whole_work' ? { kind, tmdbId: 10 } : {
  kind: 'seasons', coverage: 'complete', sourceSeasonNumbers: [1, 2],
  mappings: [{ sourceSeason: 1, tmdbSeriesId: 10, tmdbSeason: 1 }, { sourceSeason: 2, tmdbSeriesId: 10, tmdbSeason: 2 }],
};
beforeEach(async () => {
  pool = getPool(); store = createOwnedCaptureFixture(pool);
  db = { query: pool.query.bind(pool), async withTransaction(fn) {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  } };
  actorId = (await pool.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'fixture','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  serverId = (await pool.query("INSERT INTO media_server(type,name,url,api_key,is_active) VALUES ('plex',$1,'http://fixture.invalid','fixture',true) RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await pool.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,'library','tv',$2,true) RETURNING id", [randomUUID(), serverId])).rows[0].id;
  item = { external_id: 'source', title: 'Fixture', year: 2001, media_type: 'tv', provider_identity_invalid: true,
    provider_identity_issue: 'conflicting_provider_ids', provider_identity_field: 'tvdb_id', metadata: { summary: 'Source group summary' } };
  item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'library', { tmdb_id: [10], tvdb_id: [20, 30], imdb_id: ['tt1'] });
  layout = { identity: item.source_identity_evidence, digest: 'a'.repeat(64), seasons: [{ number: 1 }, { number: 2 }],
    episodes: [1, 2].map(season => ({ season, episode: 1, providerIds: { tmdb_id: [100 + season], tvdb_id: [], imdb_id: [] } })) };
  provider = { recheck: jest.fn(async () => {}),
    getIdentityDetails: jest.fn(async () => ({ id: 10, name: 'Fixture', overview: 'Whole series description',
      seasons: [1, 2].map(number => ({ id: 50 + number, season_number: number, episode_count: 1 })) })),
    getIdentitySeasonDetails: jest.fn(async (_id, number) => ({ id: 50 + number, season_number: number,
      overview: `Season ${number} description`, episodes: [{ id: 100 + number, show_id: 10, season_number: number, episode_number: 1 }] })),
  };
  deps = { db, withLock: async fn => { await fn({ signal: new AbortController().signal }); return true; },
    getMediaServerService: () => ({ getLibraryItemLayout: async () => structuredClone(layout) }),
    createCatalogProvider: async () => provider };
  const context = await capture(); await store.finish(context);
});
afterEach(async () => {
  await pool.query('DELETE FROM media_server_items WHERE media_server_id=$1', [serverId]);
  await pool.query('DELETE FROM libraries WHERE media_server_id=$1', [serverId]);
  await pool.query('DELETE FROM media_server WHERE id=$1', [serverId]);
  await pool.query('DELETE FROM audit_log WHERE user_id=$1', [actorId]);
  await pool.query('DELETE FROM users WHERE id=$1', [actorId]);
});
async function capture() { const context = await store.start(serverId, libraryId); await store.capture(context, [item]); return context; }
async function approvalInput(proposal = scope('seasons')) {
  const entry = (await readSourceIdentityIssues(db)).items.find(value => value.libraryId === libraryId);
  const body = { offset: 0, sourceVersion: entry.sourceVersion, scope: proposal };
  const evidence = await createSourceScopeEvidenceService(deps)(actorId, entry.key, body);
  return { key: entry.key, body: { ...body, evidenceFingerprint: evidence.evidenceFingerprint, confirmed: true } };
}
async function approve(proposal) {
  const input = await approvalInput(proposal);
  return createSourceMappingApproval(deps)(actorId, input.key, input.body);
}
const count = async () => (await pool.query('SELECT count(*)::int AS count FROM media_source_observations WHERE library_id=$1', [libraryId])).rows[0].count;
function recover(context, signal) {
  return createSourceMappingRecovery({ store, context, createCatalogProvider: deps.createCatalogProvider,
    source: { service: deps.getMediaServerService(), url: 'http://fixture.invalid', apiKey: 'fixture', libraryKey: 'library', signal } });
}
async function corpus() {
  return (await pool.query(buildInventoryDescriptionCorpusSql({ includeSourceItems: true, libraryScoped: true }), [30, libraryId])).rows;
}

test.each(['whole_work', 'seasons'])('approval, owned completion, repeat sync and revocation: %s', async kind => {
  const approved = await approve(scope(kind));
  expect(approved).toMatchObject({ status: 'approved', materialized: false });
  expect(await count()).toBe(1);
  const management = createSourceMappingManagement(db);
  expect((await management.listSourceMappings(actorId)).items.find(value => value.id === approved.mappingId).status).toBe('awaiting_sync');
  const context = await capture();
  const result = await recover(context)(item);
  expect(result.proof).toBeTruthy();
  expect(await persistSourceMapping(store, context, result.proof, { analyze })).toBe(true);
  await store.finish(context);
  expect(await count()).toBe(0);
  const row = (await pool.query('SELECT * FROM media_server_items WHERE library_id=$1', [libraryId])).rows[0];
  expect(row).toMatchObject({ tmdb_id: kind === 'whole_work' ? 10 : null, imdb_id: null, tvdb_id: null,
    metadata: { source_catalog_mapping: { version: 1, id: approved.mappingId } } });
  if (kind === 'seasons') {
    const rows = await corpus();
    expect(rows.map(value => value.overview).sort()).toEqual(['Season 1 description', 'Season 2 description']);
    expect(prepareInventoryDescriptionCorpus(rows, { includeSourceItems: true }).documents.map(value => value.key).sort())
      .toEqual(['tv:10:season:1', 'tv:10:season:2']);
  }
  await pool.query("UPDATE media_server_items SET inventory_tmdb_fetched_at='2026-09-01T00:00:00Z' WHERE library_id=$1", [libraryId]);
  const repeated = await capture();
  expect(await persistSourceMapping(store, repeated, (await recover(repeated)(item)).proof, { analyze })).toBe(true);
  expect((await pool.query('SELECT inventory_tmdb_fetched_at FROM media_server_items WHERE library_id=$1', [libraryId])).rows[0].inventory_tmdb_fetched_at.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  await store.finish(repeated);
  expect((await management.listSourceMappings(actorId)).items.find(value => value.id === approved.mappingId).status).toBe('materialized');
  expect(await management.revokeSourceMapping(actorId, approved.mappingId, { confirmed: true })).toMatchObject({ status: 'revoked' });
  expect(await count()).toBe(1);
  expect(await corpus()).toEqual([]);
  expect((await readSourceIdentityIssues(db)).items.some(value => value.libraryId === libraryId)).toBe(true);
  expect(await management.revokeSourceMapping(actorId, approved.mappingId, { confirmed: true })).toMatchObject({ status: 'revoked' });
});

test('refuses partial mappings even when the mapped season matches', async () => {
  const partial = { ...scope('seasons'), coverage: 'partial', mappings: [scope('seasons').mappings[0]] };
  await expect(approve(partial)).rejects.toMatchObject({ statusCode: 409, code: 'scope_incomplete' });
  expect((await pool.query('SELECT id FROM source_catalog_mappings WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
  expect(await count()).toBe(1);
});

test.each(['fingerprint', 'source', 'actor', 'confirmation', 'episode'])('approval refuses changed %s', async mode => {
  const input = await approvalInput();
  if (mode === 'fingerprint') input.body.evidenceFingerprint = '0'.repeat(64);
  if (mode === 'source') layout.identity.snapshotDigest = '0'.repeat(64);
  if (mode === 'actor') await pool.query("UPDATE users SET role='user' WHERE id=$1", [actorId]);
  if (mode === 'confirmation') input.body.confirmed = false;
  if (mode === 'episode') layout.episodes[1].providerIds.tmdb_id = [];
  await expect(createSourceMappingApproval(deps)(actorId, input.key, input.body)).rejects.toMatchObject({ statusCode: mode === 'actor' ? 403 : mode === 'confirmation' ? 400 : 409 });
  expect(await count()).toBe(1);
});

test('same approval is idempotent; audit failure rolls all writes back', async () => {
  const input = await approvalInput();
  const failDb = { ...db, withTransaction: fn => db.withTransaction(client => fn({ query: (sql, params) =>
    sql.includes('INSERT INTO audit_log') ? Promise.reject(new Error('private database detail')) : client.query(sql, params) })) };
  await expect(createSourceMappingApproval({ ...deps, db: failDb })(actorId, input.key, input.body)).rejects.toMatchObject({ statusCode: 503 });
  expect((await pool.query('SELECT id FROM source_catalog_mappings WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
  const first = await createSourceMappingApproval(deps)(actorId, input.key, input.body);
  expect(await createSourceMappingApproval(deps)(actorId, input.key, input.body)).toEqual(first);
  expect((await pool.query("SELECT id FROM audit_log WHERE user_id=$1 AND action='source_mapping_approved'", [actorId])).rowCount).toBe(1);
});

test.each(['source', 'catalog', 'config', 'disabled', 'revoked', 'capture'])('owned persistence rejects %s drift without clearing the issue', async mode => {
  const approved = await approve(); const context = await capture();
  const proof = (await recover(context)(item)).proof;
  if (mode === 'source') await pool.query("UPDATE media_source_observations SET source_digest=repeat('0',64) WHERE library_id=$1", [libraryId]);
  if (mode === 'catalog') await pool.query("UPDATE source_catalog_mappings SET configuration_digest=repeat('0',64) WHERE id=$1", [approved.mappingId]);
  if (mode === 'config') await pool.query("UPDATE media_server SET api_key='rotated' WHERE id=$1", [serverId]);
  if (mode === 'disabled') await pool.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  if (mode === 'revoked') await createSourceMappingManagement(db).revokeSourceMapping(actorId, approved.mappingId, { confirmed: true });
  if (mode === 'capture') await capture();
  expect(await persistSourceMapping(store, context, proof, { analyze })).toBe(false);
  expect(await count()).toBe(1);
});

test('failed verification cooldown survives a new recovery instance and a new scan', async () => {
  await approve(); let context = await capture();
  provider.getIdentityDetails.mockRejectedValue(new Error('private provider details'));
  expect(await recover(context)(item)).toEqual({ handled: true, proof: null });
  expect(provider.getIdentityDetails).toHaveBeenCalledTimes(5); // Four preview/approval reads, one failed recovery.
  await store.finish(context); context = await capture();
  expect(await recover(context)(item)).toEqual({ handled: true, proof: null });
  expect(provider.getIdentityDetails).toHaveBeenCalledTimes(5);
  expect((await pool.query('SELECT attempt_count,last_outcome FROM source_catalog_mappings WHERE library_id=$1', [libraryId])).rows[0])
    .toEqual({ attempt_count: 1, last_outcome: 'deferred:catalog_unavailable' });
  expect(await count()).toBe(1);
});

test.each(['source_changed', 'configuration_changed', 'source_seasons_changed', 'missing_tmdb_episode_id', 'catalog_season_missing'])('records a specific deferred reason without clearing the issue: %s', async code => {
  const approved = await approve(); const context = await capture();
  if (code === 'source_changed') item.source_identity_evidence.snapshotDigest = '0'.repeat(64);
  if (code === 'configuration_changed') await pool.query("UPDATE media_server SET api_key='changed' WHERE id=$1", [serverId]);
  if (code === 'source_seasons_changed') layout.seasons.push({ number: 3 });
  if (code === 'missing_tmdb_episode_id') layout.episodes[0].providerIds.tmdb_id = [];
  if (code === 'catalog_season_missing') provider.getIdentityDetails.mockResolvedValue({ id: 10, name: 'Fixture', seasons: [] });
  expect(await recover(context)(item)).toEqual({ handled: true, proof: null });
  const saved = (await createSourceMappingManagement(db).listSourceMappings(actorId)).items.find(value => value.id === approved.mappingId);
  expect(saved).toMatchObject({ status: 'verification_deferred', diagnostic: { code } });
  expect(saved.retryAfter).toBeTruthy();
  expect(await count()).toBe(1);
});

test('cached layout failure retains cooldown across scans and exposes no provider text', async () => {
  const approved = await approve(); let context = await capture();
  await persistSourceMapping(store, context, (await recover(context)(item)).proof, { analyze });
  await store.finish(context);
  const read = jest.fn(async () => { throw new Error('secret provider URL'); });
  deps.getMediaServerService = () => ({ getLibraryItemLayout: read });
  context = await capture(); const attempt = recover(context);
  expect(await attempt(item)).toEqual({ handled: true, proof: null });
  expect(await attempt(item)).toEqual({ handled: true, proof: null });
  await store.finish(context);
  context = await capture(); expect(await recover(context)(item)).toEqual({ handled: true, proof: null });
  expect(read).toHaveBeenCalledTimes(1);
  const saved = (await createSourceMappingManagement(db).listSourceMappings(actorId)).items.find(value => value.id === approved.mappingId);
  expect(saved).toMatchObject({ status: 'verification_deferred', diagnostic: { code: 'source_unavailable' } });
  expect(JSON.stringify(saved)).not.toContain('secret');
  expect(await count()).toBe(1);
});

test('legacy and interrupted attempts remain explicitly unconfirmed without provider reads', async () => {
  const approved = await approve(); const reads = provider.getIdentityDetails.mock.calls.length;
  for (const [outcome, code] of [['verification_deferred', 'unknown'], ['checking', 'check_unconfirmed'], ['deferred:private', 'unknown']]) {
    await pool.query('UPDATE source_catalog_mappings SET last_outcome=$1 WHERE id=$2', [outcome, approved.mappingId]);
    expect((await createSourceMappingManagement(db).listSourceMappings(actorId)).items.find(value => value.id === approved.mappingId))
      .toMatchObject({ status: 'verification_deferred', diagnostic: { code } });
  }
  expect(provider.getIdentityDetails).toHaveBeenCalledTimes(reads);
});

test('an inventory completion failure rolls back the receipt, description documents and observation deletion', async () => {
  await approve(); const context = await capture(); const proof = (await recover(context)(item)).proof;
  const failStore = { withCurrentCapture: (ctx, fn) => store.withCurrentCapture(ctx, tx => fn({ query: (sql, values) =>
    sql.includes('DELETE FROM media_source_observations') ? Promise.reject(new Error('fixture completion failed')) : tx.query(sql, values) })) };
  await expect(persistSourceMapping(failStore, context, proof, { analyze })).rejects.toThrow('fixture completion failed');
  expect(await count()).toBe(1);
  expect((await pool.query('SELECT materialized_at FROM source_catalog_mappings WHERE library_id=$1', [libraryId])).rows[0].materialized_at).toBeNull();
  expect((await pool.query('SELECT id FROM media_server_items WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
});

test('stale season receipts never fall back to the grouped source description', async () => {
  await approve(); const context = await capture();
  await persistSourceMapping(store, context, (await recover(context)(item)).proof, { analyze });
  await store.finish(context);
  await pool.query("UPDATE source_catalog_mappings SET materialized_at=clock_timestamp()-interval '31 days' WHERE library_id=$1", [libraryId]);
  expect(await corpus()).toEqual([]);
});

test('fresh source layout permits bounded catalog reuse without extending its verification time', async () => {
  await approve(); let context = await capture();
  const first = (await recover(context)(item)).proof;
  await persistSourceMapping(store, context, first, { analyze }); await store.finish(context);
  const catalogReads = provider.getIdentityDetails.mock.calls.length;
  context = await capture();
  const reused = (await recover(context)(item)).proof;
  expect(new Date(reused.catalogVerifiedAt).getTime()).toBe(new Date(first.catalogVerifiedAt).getTime());
  expect(provider.getIdentityDetails).toHaveBeenCalledTimes(catalogReads);
  await persistSourceMapping(store, context, reused, { analyze }); await store.finish(context);
  await pool.query("UPDATE source_catalog_mappings SET catalog_verified_at=clock_timestamp()-interval '25 hours' WHERE library_id=$1", [libraryId]);
  context = await capture();
  expect((await recover(context)(item)).proof).toBeTruthy();
  expect(provider.getIdentityDetails).toHaveBeenCalledTimes(catalogReads + 2);
});

test('a newly added unmapped season prevents cached reuse and keeps the item unresolved', async () => {
  await approve(); let context = await capture();
  await persistSourceMapping(store, context, (await recover(context)(item)).proof, { analyze }); await store.finish(context);
  layout.digest = 'b'.repeat(64); layout.seasons.push({ number: 3 });
  layout.episodes.push({ season: 3, episode: 1, providerIds: { tmdb_id: [103], tvdb_id: [], imdb_id: [] } });
  context = await capture();
  expect(await recover(context)(item)).toEqual({ handled: true, proof: null });
  expect(await count()).toBe(1);
});

test('simultaneous duplicate approvals create one mapping and one audit record', async () => {
  const input = await approvalInput();
  const results = await Promise.all([1, 2].map(() => createSourceMappingApproval(deps)(actorId, input.key, input.body)));
  expect(results[0]).toEqual(results[1]);
  expect((await pool.query("SELECT id FROM audit_log WHERE user_id=$1 AND action='source_mapping_approved'", [actorId])).rowCount).toBe(1);
});

test('revocation cannot cross an active ingestion owner', async () => {
  const approved = await approve(); const owner = await pool.connect();
  try {
    await owner.query('SELECT pg_advisory_lock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK,libraryId]);
    await expect(createSourceMappingManagement(db).revokeSourceMapping(actorId, approved.mappingId, { confirmed: true }))
      .rejects.toMatchObject({ statusCode: 409, code: 'mapping_ingestion_active' });
    expect((await pool.query('SELECT revoked_at FROM source_catalog_mappings WHERE id=$1', [approved.mappingId])).rows[0].revoked_at).toBeNull();
  } finally { await owner.query('SELECT pg_advisory_unlock($1::integer,$2::integer)', [MEDIA_SYNC_OWNER_LOCK,libraryId]); owner.release(); }
});
