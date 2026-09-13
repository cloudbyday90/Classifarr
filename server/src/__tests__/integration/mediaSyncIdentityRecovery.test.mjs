/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { MediaSourceObservationStore } from '../../services/mediaSourceObservationStore.mjs';
import { claimSyncIdentityRecovery, persistRecoveredSyncItem, readSyncIdentityRecoveryReceipt } from '../../services/mediaSyncIdentityRecoveryPersistence.mjs';
import { sourceIdentityRecoveryEvidence } from '../../services/sourceIdentityRecoveryEvidence.mjs';
import { createMediaSyncSkipReporter } from '../../services/mediaSyncSkipReporter.mjs';
import { readRefillCandidatePage } from '../../services/queueRefillCandidates.mjs';

let pool, store, serverId, libraryId, item, recovery;
const analyze = async () => ({ analyzed: false });
beforeEach(async () => {
  pool = getPool();
  store = new MediaSourceObservationStore({ withTransaction: async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } });
  serverId = (await pool.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://fixture.invalid','fixture') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await pool.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,$2,'movie',$3,true) RETURNING id", [randomUUID(), randomUUID(), serverId])).rows[0].id;
  item = { external_id: 'fixture', title: 'Fixture', year: 2001, media_type: 'movie',
    provider_identity_invalid: true, provider_identity_issue: 'conflicting_provider_ids', provider_identity_field: 'tmdb_id',
    metadata: { summary: 'Fixture summary', source_identity_recovery: { forged: true } } };
  item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'library-1', { tmdb_id: [11, 22], imdb_id: ['tt123'], tvdb_id: [] });
  recovery = { item: { ...item, provider_identity_invalid: false, tmdb_id: 22, imdb_id: 'tt123', tvdb_id: null },
    receipt: { version: 1, method: 'external_candidate_agreement', source_digest: item.source_identity_evidence.snapshotDigest, tmdb_id: 22 } };
});
afterEach(async () => {
  await pool.query('DELETE FROM media_server_items WHERE media_server_id=$1', [serverId]);
  await pool.query('DELETE FROM libraries WHERE media_server_id=$1', [serverId]);
  await pool.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});
async function capture() { const context = await store.start(serverId, libraryId); await store.capture(context, [item]); return context; }
async function countConflicts() { return (await pool.query('SELECT count(*)::int AS count FROM media_source_observations WHERE library_id=$1', [libraryId])).rows[0].count; }
const warning = count => ({ skippedItemCount: count, reasonCounts: { invalid_source_identity: count }, identityIssueCounts: { conflicting_provider_ids: count } });
const reportContext = id => ({ libraryId, mediaServerId: serverId, syncStatusId: id, sourceType: 'plex' });

test('commits repaired inventory, server receipt, observation removal and backfill eligibility together', async () => {
  const context = await capture();
  expect(await claimSyncIdentityRecovery(store, context, item)).toBe(true);
  expect(await persistRecoveredSyncItem(store, context, recovery, { analyze })).toBe(true);
  expect(await countConflicts()).toBe(0);
  const row = (await pool.query('SELECT tmdb_id,metadata,inventory_tmdb_attempted_at,inventory_tmdb_fetched_at FROM media_server_items WHERE library_id=$1', [libraryId])).rows[0];
  expect(row).toMatchObject({ tmdb_id: 22, inventory_tmdb_attempted_at: null, inventory_tmdb_fetched_at: null,
    metadata: { source_identity_recovery: recovery.receipt } });
  expect(row.metadata.source_identity_recovery.forged).toBeUndefined();
  expect((await readRefillCandidatePage(pool, null)).rows.some(candidate => candidate.library_id === libraryId)).toBe(true);
  expect(await readSyncIdentityRecoveryReceipt(store, context, item)).toEqual(recovery.receipt);
  await store.finish(context);
  expect(await countConflicts()).toBe(0);
});

test('another verified sync preserves completed metadata backfill for the same identity', async () => {
  let context = await capture();
  await persistRecoveredSyncItem(store, context, recovery, { analyze });
  await pool.query(`UPDATE media_server_items SET inventory_tmdb_attempted_at='2026-09-13T00:00:00Z',
    inventory_tmdb_fetched_at='2026-09-13T00:00:00Z' WHERE library_id=$1`, [libraryId]);
  context = await capture();
  expect(await persistRecoveredSyncItem(store, context, recovery, { analyze })).toBe(true);
  const row = (await pool.query('SELECT inventory_tmdb_attempted_at,inventory_tmdb_fetched_at FROM media_server_items WHERE library_id=$1', [libraryId])).rows[0];
  expect(row.inventory_tmdb_fetched_at.toISOString()).toBe('2026-09-13T00:00:00.000Z');
  expect(row.inventory_tmdb_attempted_at).toEqual(row.inventory_tmdb_fetched_at);
});

test('failed persistence rolls back inventory and leaves the conflict available for retry', async () => {
  const context = await capture();
  const failStore = { withCurrentCapture: (ctx, fn) => store.withCurrentCapture(ctx, client => fn({
    query: (sql, values) => sql.includes('DELETE FROM media_source_observations')
      ? Promise.reject(new Error('fixture failure after inventory write')) : client.query(sql, values),
  })) };
  await expect(persistRecoveredSyncItem(failStore, context, recovery, { analyze })).rejects.toThrow('fixture failure');
  expect(await countConflicts()).toBe(1);
  expect((await pool.query('SELECT id FROM media_server_items WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
});

test('superseded capture or changed candidate digest cannot clear an observation', async () => {
  const older = await capture(); const current = await capture();
  expect(await persistRecoveredSyncItem(store, older, recovery, { analyze })).toBe(false);
  await pool.query("UPDATE media_source_observations SET source_digest=repeat('0',64) WHERE library_id=$1", [libraryId]);
  expect(await persistRecoveredSyncItem(store, current, recovery, { analyze })).toBe(false);
  expect(await countConflicts()).toBe(1);
});

test('retry cooldown survives another capture, expires, and resets immediately on changed source evidence', async () => {
  let context = await capture();
  expect(await claimSyncIdentityRecovery(store, context, item)).toBe(true);
  expect(await claimSyncIdentityRecovery(store, context, item)).toBe(false);
  await store.finish(context); context = await capture();
  expect(await claimSyncIdentityRecovery(store, context, item)).toBe(false);
  await pool.query("UPDATE media_source_observations SET recovery_retry_after=NOW()-INTERVAL '1 second' WHERE library_id=$1", [libraryId]);
  expect(await claimSyncIdentityRecovery(store, context, item)).toBe(true);
  item.year = 2002;
  item.source_identity_evidence = sourceIdentityRecoveryEvidence(item, 'library-1', item.source_identity_evidence.providerIds);
  context = await capture();
  expect(await claimSyncIdentityRecovery(store, context, item)).toBe(true);
});

test('concurrent recovery claims admit one attempt and changed library ownership blocks persistence', async () => {
  const context = await capture();
  expect((await Promise.all([claimSyncIdentityRecovery(store, context, item), claimSyncIdentityRecovery(store, context, item)])).filter(Boolean)).toHaveLength(1);
  await pool.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  expect(await persistRecoveredSyncItem(store, context, recovery, { analyze })).toBe(false);
  expect(await countConflicts()).toBe(1);
});

test('warning state survives reporter recreation; changed counts and daily reminders still notify', async () => {
  const logger = { warn: jest.fn() }; const query = pool.query.bind(pool);
  await createMediaSyncSkipReporter({ query, logger }).report(reportContext(100), warning(2));
  await createMediaSyncSkipReporter({ query, logger }).report(reportContext(101), warning(2));
  expect(logger.warn).toHaveBeenCalledTimes(1);
  await createMediaSyncSkipReporter({ query, logger }).report(reportContext(102), warning(3));
  expect(logger.warn).toHaveBeenCalledTimes(2);
  await pool.query("UPDATE media_sync_warning_state SET last_warned_at=NOW()-INTERVAL '25 hours' WHERE library_id=$1", [libraryId]);
  await createMediaSyncSkipReporter({ query, logger }).report(reportContext(103), warning(3));
  expect(logger.warn).toHaveBeenCalledTimes(3);
});

test('concurrent identical warnings notify once; older clean completions do not erase newer failures', async () => {
  const logger = { warn: jest.fn() }; const query = pool.query.bind(pool);
  await Promise.all([100, 101, 102].map(id => createMediaSyncSkipReporter({ query, logger }).report(reportContext(id), warning(2))));
  expect(logger.warn).toHaveBeenCalledTimes(1);
  const reporter = createMediaSyncSkipReporter({ query, logger });
  await reporter.report(reportContext(99), null);
  await reporter.report(reportContext(103), warning(2));
  expect(logger.warn).toHaveBeenCalledTimes(1);
  await reporter.report(reportContext(104), null);
  await reporter.report(reportContext(105), warning(2));
  expect(logger.warn).toHaveBeenCalledTimes(2);
});

test('incremental clean scans do not reset full-scan warning state and deletion removes the state', async () => {
  const logger = { warn: jest.fn() }; const reporter = createMediaSyncSkipReporter({ query: pool.query.bind(pool), logger });
  await reporter.report(reportContext(100), warning(2));
  await reporter.report({ ...reportContext(101), incremental: true }, null);
  await reporter.report(reportContext(102), warning(2));
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect((await pool.query('SELECT library_id FROM media_sync_warning_state WHERE library_id=$1', [libraryId])).rowCount).toBe(2);
  await pool.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  expect((await pool.query('SELECT library_id FROM media_sync_warning_state WHERE library_id=$1', [libraryId])).rowCount).toBe(0);
});
