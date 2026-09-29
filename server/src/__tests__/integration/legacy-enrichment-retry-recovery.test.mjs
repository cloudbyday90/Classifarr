/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createLegacyEnrichmentRetryService } from '../../services/legacyEnrichmentRetryService.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { EnrichmentItemStateService } from '../../services/enrichmentItemStateService.mjs';
import { claimEnrichmentRetry } from '../../services/enrichmentRetryClaimService.mjs';
import { TAVILY_MONTHLY_DEFERRED_REASON } from '../../utils/enrichmentState.mjs';
const db = createIntegrationDatabaseModuleMock();
let libraryId, serverId, actorId, itemId, service, wake;
const preview = () => service.preview(actorId, libraryId);
const confirm = (review, requestId = randomUUID()) => service.confirm(actorId, libraryId, { requestId, workersStopped: true }, review.revision);
const retries = async () => (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1 ORDER BY id', [itemId])).rows;
const item = async () => (await db.query('SELECT * FROM media_server_items WHERE id=$1', [itemId])).rows[0];
beforeEach(async () => {
  actorId = (await db.query("INSERT INTO users(username,password_hash,role,is_active) VALUES ($1,'synthetic','admin',true) RETURNING id", [randomUUID()])).rows[0].id;
  serverId = (await db.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://synthetic.invalid','synthetic') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await db.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ($1,$1,'movie',$2,true) RETURNING id", [randomUUID(), serverId])).rows[0].id;
  itemId = (await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,tmdb_id,imdb_id,metadata)
    VALUES ($1,$2,'old','Synthetic','movie',77,'tt0000077','{"sentinel":"preserved"}') RETURNING id`, [serverId, libraryId])).rows[0].id;
  await db.query(`INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,status,attempts,reason,last_attempt_at)
    VALUES ($1,'omdb','processing',1,'Legacy reason',NOW()-interval '1 year')`, [itemId]);
  wake = jest.fn(); service = createLegacyEnrichmentRetryService(db, { onRecovered: wake });
});
afterEach(async () => {
  await db.query('DELETE FROM audit_log WHERE user_id=$1', [actorId]);
  await db.query('DELETE FROM media_server_items WHERE library_id=$1', [libraryId]);
  await db.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await db.query('DELETE FROM media_server WHERE id=$1', [serverId]);
  await db.query('DELETE FROM users WHERE id=$1', [actorId]);
});
test.each(['plex', 'jellyfin', 'emby'].flatMap(provider => ['movie', 'tv'].map(type => [provider, type])))('%s %s legacy retry recovers and completes with a real new claim', async (provider, type) => {
  await db.query('UPDATE media_server SET type=$2 WHERE id=$1', [serverId, provider]);
  await db.query('UPDATE libraries SET media_type=$2 WHERE id=$1', [libraryId, type]);
  await db.query('UPDATE media_server_items SET media_type=$2 WHERE id=$1', [itemId, type]);
  const before = await retries(), metadata = (await item()).metadata;
  const review = await preview(), requestId = randomUUID();
  expect(review).toMatchObject({ canRecover: true, items: [{ title: 'Synthetic', attempts: 1 }] });
  expect(await retries()).toEqual(before);
  const result = await confirm(review, requestId);
  expect(result).toMatchObject({ repeated: false, receipt: { queued: 1, exhausted: 0 } });
  expect(await confirm(review, requestId)).toEqual({ ...result, repeated: true });
  expect(await service.receipt(actorId, libraryId, requestId)).toEqual({ receipt: result.receipt });
  expect(wake).toHaveBeenCalledTimes(1);
  expect((await item()).metadata).toEqual(metadata);
  expect((await retries())[0]).toMatchObject({ attempts: 1, reason: 'Legacy reason', last_attempt_at: before[0].last_attempt_at, status: 'pending', claim_token: null });
  const retryService = new EnrichmentRetryService({ db, logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    omdbService: { getByIMDBId: async () => ({ Title: 'Recovered evidence' }),
      hasRemainingQuota: async () => ({ available: true }) } });
  expect(await retryService.processRetryQueue(1, 'omdb')).toMatchObject({ success: 1 });
  expect((await retries())[0]).toMatchObject({ status: 'completed', attempts: 1, claim_token: null });
  expect((await item()).metadata).toMatchObject({ sentinel: 'preserved', omdb: { data: { Title: 'Recovered evidence' } } });
});
test.each(['source', 'retry', 'claim', 'library', 'delete'])('changed %s rejects entire reviewed batch', async change => {
  const review = await preview();
  if (change === 'source') await db.query("UPDATE media_server_items SET title='Changed' WHERE id=$1", [itemId]);
  if (change === 'retry') await db.query('UPDATE enrichment_retry_queue SET attempts=2 WHERE media_item_id=$1', [itemId]);
  if (change === 'claim') await db.query('UPDATE enrichment_retry_queue SET claim_token=$2 WHERE media_item_id=$1', [itemId, randomUUID()]);
  if (change === 'library') await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  if (change === 'delete') await db.query('DELETE FROM enrichment_retry_queue WHERE media_item_id=$1', [itemId]);
  const before = await retries();
  await expect(confirm(review)).rejects.toMatchObject({ status: 412 });
  expect(await retries()).toEqual(before); expect(wake).not.toHaveBeenCalled();
});
test('newly claimed, expired and partial claims are never reconciled', async () => {
  for (const [token, deadline] of [[randomUUID(), new Date(0)], [randomUUID(), new Date(Date.now()+60000)], [randomUUID(), null], [null, new Date(0)]]) {
    await db.query('UPDATE enrichment_retry_queue SET claim_token=$2,claim_until=$3 WHERE media_item_id=$1', [itemId, token, deadline]);
    const review = await preview(); expect(review.items).toEqual([]);
    await expect(confirm(review)).rejects.toMatchObject({ status: 409 });
  }
});
test('exhausted budgets, disabled libraries and quota timestamps are preserved', async () => {
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  await db.query('UPDATE enrichment_retry_queue SET attempts=max_attempts WHERE media_item_id=$1', [itemId]);
  await db.query(`INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,status,reason,last_attempt_at)
    VALUES ($1,'tavily','processing',$2,NOW())`, [itemId, TAVILY_MONTHLY_DEFERRED_REASON]);
  const before = await retries();
  expect(await confirm(await preview())).toMatchObject({ receipt: { queued: 1, exhausted: 1 } });
  const after = await retries();
  expect(after[0]).toMatchObject({ status: 'failed', attempts: 3 });
  expect(after[1]).toMatchObject({ status: 'pending', attempts: 0, reason: before[1].reason, last_attempt_at: before[1].last_attempt_at });
  expect((await db.query('SELECT is_active FROM libraries WHERE id=$1', [libraryId])).rows[0].is_active).toBe(false);
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [libraryId]);
  expect(await claimEnrichmentRetry(db, 'tavily')).toBeNull();
});
test('bounds recovery to the displayed 50 records and leaves later records for another review', async () => {
  await db.query(`WITH items AS (INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type)
    SELECT $1,$2,'extra-'||n,'Synthetic '||n,'movie' FROM generate_series(1,51) n RETURNING id)
    INSERT INTO enrichment_retry_queue(media_item_id,enrichment_type,status) SELECT id,'omdb','processing' FROM items`, [serverId, libraryId]);
  const review = await preview(); expect(review.items).toHaveLength(50); expect(review.hasMore).toBe(true);
  expect(await confirm(review)).toMatchObject({ receipt: { queued: 50 } });
  expect((await preview()).items).toHaveLength(2);
});
test('concurrent same-request confirmations have one durable receipt and one wake-up', async () => {
  const review = await preview(), requestId = randomUUID();
  const results = await Promise.all([confirm(review, requestId), confirm(review, requestId)]);
  expect(results.filter(row => !row.repeated)).toHaveLength(1);
  expect(results[0].receipt).toEqual(results[1].receipt); expect(wake).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT count(*)::int AS n FROM audit_log WHERE user_id=$1', [actorId])).rows[0].n).toBe(1);
});
test('different concurrent confirmations cannot recover the same records twice', async () => {
  const review = await preview(); const results = await Promise.allSettled([confirm(review), confirm(review)]);
  expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(row => row.status === 'rejected').reason.status).toBe(412);
});
test.each(['state', 'audit'])('%s failure rolls back the entire recovery', async failure => {
  const before = await retries(), source = await item();
  if (failure === 'state') service = createLegacyEnrichmentRetryService(db, { itemState: { syncItemState: async () => { throw new Error('state failed'); } }, onRecovered: wake });
  else service = createLegacyEnrichmentRetryService({ withTransaction: work => db.withTransaction(client => work({
    query: (sql, params) => sql.startsWith('INSERT INTO audit_log') ? Promise.reject(new Error('audit failed')) : client.query(sql, params),
  })) }, { itemState: new EnrichmentItemStateService({ db }), onRecovered: wake });
  await expect(confirm(await preview())).rejects.toThrow(`${failure} failed`);
  expect(await retries()).toEqual(before); expect(await item()).toEqual(source); expect(wake).not.toHaveBeenCalled();
});
test('lost commit reply is resolved by a read-only receipt without a second mutation', async () => {
  const requestId = randomUUID(), review = await preview();
  let lost = false;
  service = createLegacyEnrichmentRetryService({ withTransaction: async work => {
    let mutation = false;
    const result = await db.withTransaction(client => work({ query: (sql, params) => {
      if (sql.startsWith('INSERT INTO audit_log')) mutation = true;
      return client.query(sql, params);
    } }));
    if (mutation && !lost) { lost = true; throw new Error('commit reply lost'); }
    return result;
  } }, { onRecovered: wake });
  await expect(confirm(review, requestId)).rejects.toThrow('commit reply lost');
  expect(wake).not.toHaveBeenCalled();
  expect(await service.receipt(actorId, libraryId, requestId)).toMatchObject({ receipt: { queued: 1 } });
  expect(await confirm(review, requestId)).toMatchObject({ repeated: true });
  expect((await retries())[0].status).toBe('pending');
});
test('revoked administrators, mismatched receipts and corrupt receipts fail closed', async () => {
  const review = await preview(), requestId = randomUUID();
  await confirm(review, requestId);
  await expect(service.receipt(actorId, libraryId+1, requestId)).rejects.toMatchObject({ status: 409 });
  await expect(confirm(await preview(), requestId)).rejects.toMatchObject({ status: 409 });
  await db.query('UPDATE users SET is_active=false WHERE id=$1', [actorId]);
  await expect(preview()).rejects.toMatchObject({ status: 403 });
  await expect(confirm(review, requestId)).rejects.toMatchObject({ status: 403 });
  await expect(service.receipt(actorId, libraryId, requestId)).rejects.toMatchObject({ status: 403 });
  await db.query('UPDATE users SET is_active=true WHERE id=$1', [actorId]);
  await db.query("UPDATE audit_log SET metadata=metadata-'verification' WHERE user_id=$1", [actorId]);
  await expect(service.receipt(actorId, libraryId, requestId)).rejects.toMatchObject({ status: 503 });
});
test('archived, unsupported and absent libraries cannot recover; missing receipt is not success', async () => {
  await db.query('UPDATE libraries SET archived_at=NOW(),is_active=false WHERE id=$1', [libraryId]);
  expect((await preview()).reason).toBe('library_archived');
  await expect(confirm(await preview())).rejects.toMatchObject({ status: 409 });
  await db.query("UPDATE media_server_items SET media_type='track' WHERE id=$1", [itemId]);
  expect((await preview()).items).toEqual([]);
  await expect(service.preview(actorId, 2147483647)).rejects.toMatchObject({ status: 404 });
  expect(await service.receipt(actorId, libraryId, randomUUID())).toEqual({ receipt: null });
});
test('a failed wake-up cannot hide the committed receipt', async () => {
  wake.mockRejectedValueOnce(new Error('unavailable'));
  expect(await confirm(await preview())).toMatchObject({ receipt: { queued: 1 } });
  expect((await retries())[0].status).toBe('pending');
});
