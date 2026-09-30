/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createHandoffFixture } from '../helpers/sourceRecoveryHandoffFixture.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { claimEnrichmentRetry, createEnrichmentRetryWriteGuard } from '../../services/enrichmentRetryClaimService.mjs';
import { readEnrichmentRetryPage } from '../../services/enrichmentRetryCandidates.mjs';
import { persistEnrichmentRetryResult } from '../../services/enrichmentRetryResultPersistence.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';

const db = createIntegrationDatabaseModuleMock();
let fixture, service, media;
beforeEach(async () => {
  await seedOmdbQuotaFixture(db);
  fixture = await createHandoffFixture(db, 'movie');
  await fixture.scan();
  media = (await fixture.inventory())[0];
  service = new EnrichmentRetryService({ db, logger: fixture.log,
    omdbService: { getByIMDBId: jest.fn().mockResolvedValue({ Title: 'Current evidence' }) },
  });
  jest.spyOn(service, 'scheduleProcessing').mockImplementation(() => {});
  await service.queueForRetry(media.id, 'omdb');
});
afterEach(async () => { service.cancelScheduledProcessing(); await fixture.cleanup(); });
const rows = async () => (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1 ORDER BY id', [media.id])).rows;
const stored = async () => (await db.query('SELECT * FROM media_server_items WHERE id=$1', [media.id])).rows[0];
const expire = () => db.query("UPDATE enrichment_retry_queue SET claim_until=clock_timestamp()-interval '1 second' WHERE media_item_id=$1", [media.id]);
const claim = () => claimEnrichmentRetry(db, 'omdb');
const finish = (item, result = { success: true, data: { Title: 'Fixture evidence' } }) =>
  createEnrichmentRetryWriteGuard(db, item, 'omdb')((client, authority, current) =>
    persistEnrichmentRetryResult(client, authority, current, item, 'omdb', result, {
      enrichmentItemStateService: service.enrichmentItemStateService,
      queueForRetry: (...args) => service.queueForRetry(...args),
    }));

test('competing consumers receive at most one current claim', async () => {
  const results = await Promise.all([claim(), claim(), claim()]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await rows())[0]).toMatchObject({ status: 'processing', claim_token: results.find(Boolean).claim_token });
});

test('two workers with the same read-only page hint receive only one ID-targeted claim', async () => {
  const [[left],[right]] = await Promise.all([readEnrichmentRetryPage(db,'omdb',null,1),readEnrichmentRetryPage(db,'omdb',null,1)]);
  expect(left.queue_id).toBe(right.queue_id);
  const results=await Promise.all([left,right].map(item=>claimEnrichmentRetry(db,'omdb',[],item.queue_id)));
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await rows())[0].claim_token).toBe(results.find(Boolean).claim_token);
});

test('candidate planning executes inside a database-enforced read-only transaction', async () => {
  const before = await rows();
  await db.withTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    const page = await readEnrichmentRetryPage(client,'omdb',null,50);
    expect(page).toHaveLength(1);
    expect(page[0].queue_id).toBe(before[0].id);
  });
  expect(await rows()).toEqual(before);
});

test.each(['expired', 'replaced', 'cancelled', 'missing'])('%s claim cannot save retry evidence or status', async state => {
  const item = await claim();
  if (state === 'expired') await expire();
  if (state === 'replaced') await db.query('UPDATE enrichment_retry_queue SET claim_token=$1 WHERE id=$2', [randomUUID(), item.queue_id]);
  if (state === 'cancelled') await db.query("UPDATE enrichment_retry_queue SET status='skipped' WHERE id=$1", [item.queue_id]);
  if (state === 'missing') item.claim_token = null;
  const before = await stored(), queueBefore = await rows();
  await expect(finish(item)).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(await stored()).toEqual(before);
  expect(await rows()).toEqual(queueBefore);
});

test('slow provider cannot overwrite a successor after expiry and crash recovery', async () => {
  let release, entered;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  service.omdbService.getByIMDBId.mockImplementationOnce(async () => { entered(); await held; return { Title: 'Old worker' }; });
  const pending = service.processRetryQueue(1, 'omdb');
  try {
    await started;
    await expire();
    expect(await service.recoverStaleProcessingRetries()).toBe(1);
    expect((await rows())[0]).toMatchObject({ status: 'pending', claim_token: null, attempts: 1 });
    expect(await service.processRetryQueue(1, 'omdb')).toMatchObject({ success: 1 });
    const before = await stored(), queueBefore = await rows();
    release();
    expect(await pending).toMatchObject({ success: 0, failed: 0 });
    expect(await stored()).toEqual(before);
    expect(await rows()).toEqual(queueBefore);
    expect(before.metadata.omdb.data.Title).toBe('Current evidence');
  } finally { release(); await pending; }
});

test('requeue and statistics do not steal a live or unknown legacy owner', async () => {
  const item = await claim();
  await service.queueForRetry(media.id, 'omdb', 'duplicate');
  await service.resolveRetriesWithExistingMetadata();
  expect((await rows())[0]).toMatchObject({ status: 'processing', claim_token: item.claim_token });
  expect(await service.recoverStaleProcessingRetries()).toBe(0);
  await db.query("UPDATE enrichment_retry_queue SET claim_token=NULL, claim_until=NULL, last_attempt_at=NOW()-interval '1 year'");
  expect(await service.recoverStaleProcessingRetries()).toBe(0);
  expect(await claim()).toBeNull();
});

test.each(['identity', 'library', 'music'])('%s change discards evidence and leaves a fresh retry without charging an attempt', async change => {
  const item = await claim();
  if (change === 'identity') await db.query("UPDATE media_server_items SET title='Changed source' WHERE id=$1", [media.id]);
  if (change === 'library') await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [media.library_id]);
  if (change === 'music') await db.query("UPDATE media_server_items SET media_type='track' WHERE id=$1", [media.id]);
  expect(await finish(item)).toBe('source_changed');
  expect((await stored()).metadata.omdb).toBeUndefined();
  expect((await rows())[0]).toMatchObject({ status: 'pending', attempts: 0, claim_token: null });
  if (change !== 'identity') expect(await claim()).toBeNull();
});

test('state failure rolls back metadata and completion together', async () => {
  const item = await claim(), before = await stored();
  jest.spyOn(service.enrichmentItemStateService, 'syncItemState').mockRejectedValue(new Error('synthetic failure'));
  await expect(finish(item)).rejects.toMatchObject({ reason: 'queue_claim_write_failed' });
  expect(await stored()).toEqual(before);
  expect((await rows())[0]).toMatchObject({ status: 'processing', claim_token: item.claim_token });
});

test('OMDb fallback enqueue, skip and state commit atomically, and rollback atomically', async () => {
  const item = await claim();
  const state = jest.spyOn(service.enrichmentItemStateService, 'syncItemState').mockRejectedValue(new Error('synthetic failure'));
  await expect(finish(item, { success: false, error: 'OMDb not found' })).rejects.toMatchObject({ reason: 'queue_claim_write_failed' });
  expect(await rows()).toHaveLength(1);
  state.mockRestore();
  expect(await finish(item, { success: false, error: 'OMDb not found' })).toBe('fallback');
  expect(await rows()).toEqual(expect.arrayContaining([
    expect.objectContaining({ enrichment_type: 'omdb', status: 'skipped', claim_token: null }),
    expect.objectContaining({ enrichment_type: 'web_search', status: 'pending' }),
  ]));
});

test('lost commit reply is not replayed or converted into provider failure', async () => {
  const transaction = db.withTransaction.bind(db);
  service._db = { ...db, withTransaction: async work => {
    let completed = false;
    const value = await transaction(client => work({ query: (...args) => {
      if (args[0].includes("status = 'completed'")) completed = true;
      return client.query(...args);
    } }));
    if (completed) throw new Error('lost reply');
    return value;
  } };
  await expect(service.processRetryQueue(1, 'omdb')).rejects.toMatchObject({ reason: 'queue_claim_write_failed' });
  expect((await rows())[0]).toMatchObject({ status: 'completed', attempts: 0, claim_token: null });
  expect((await stored()).metadata.omdb.data.Title).toBe('Current evidence');
  service._db = db;
  expect(await service.processRetryQueue(1, 'omdb')).toMatchObject({ processed: 0 });
});

test('database expiry during result persistence rolls back and revokes escaped clients', async () => {
  const item = await claim();
  await db.query("UPDATE enrichment_retry_queue SET claim_until=clock_timestamp()+interval '150 milliseconds' WHERE id=$1", [item.queue_id]);
  let escaped;
  await expect(createEnrichmentRetryWriteGuard(db, item, 'omdb')(async client => {
    escaped = client;
    await client.query("UPDATE media_server_items SET title='must rollback' WHERE id=$1", [media.id]);
    await delay(200);
  })).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect((await stored()).title).toBe(media.title);
  await expect(escaped.query('SELECT 1')).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
});

test('recovery consumes bounded attempts exactly once per expired claim', async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    expect(await claim()).not.toBeNull();
    await expire();
    expect(await service.recoverStaleProcessingRetries()).toBe(1);
    expect(await service.recoverStaleProcessingRetries()).toBe(0);
    expect((await rows())[0].attempts).toBe(attempt);
  }
  expect((await rows())[0]).toMatchObject({ status: 'failed', claim_token: null });
  expect(await claim()).toBeNull();
});

test('lease expiry while waiting for the claim lock is rechecked after acquisition', async () => {
  const item = await claim(), connection = await getPool().connect();
  let pending;
  try {
    await connection.query('BEGIN');
    await connection.query("UPDATE enrichment_retry_queue SET claim_until=clock_timestamp()+interval '100 milliseconds' WHERE id=$1", [item.queue_id]);
    pending = finish(item).catch(error => error);
    await delay(180);
    await connection.query('COMMIT');
    expect(await pending).toMatchObject({ reason: 'queue_claim_not_owned' });
    expect((await stored()).metadata.omdb).toBeUndefined();
  } finally { await connection.query('ROLLBACK'); connection.release(); if (pending) await pending; }
});

test('TV evidence commits normally without a library-specific code path', async () => {
  await db.query("UPDATE libraries SET media_type='tv' WHERE id=$1", [media.library_id]);
  await db.query("UPDATE media_server_items SET media_type='tv' WHERE id=$1", [media.id]);
  expect(await service.processRetryQueue(1, 'omdb')).toMatchObject({ success: 1 });
  expect((await stored()).metadata.omdb.data.Title).toBe('Current evidence');
});

test('monthly deferral does not immediately reclaim the same historical item', async () => {
  await db.query("UPDATE enrichment_retry_queue SET enrichment_type='tavily' WHERE media_item_id=$1", [media.id]);
  service._webSearchEnrichmentService = { hasAvailableProvider: async () => true };
  jest.spyOn(service, 'enrichWithWebSearch').mockResolvedValue({ success: false, deferUntilMonthlyReset: true, error: 'monthly quota' });
  expect(await service.processRetryQueue(50, 'tavily')).toMatchObject({ processed: 1, failed: 0 });
  expect(await service.processRetryQueue(50, 'tavily')).toMatchObject({ processed: 0 });
  expect((await rows())[0]).toMatchObject({ status: 'pending', attempts: 0, claim_token: null, reason: 'tavily_monthly_quota_deferred' });
});

test('recovery state failure rolls back the expired-claim transition', async () => {
  const item = await claim(); await expire();
  jest.spyOn(service.enrichmentItemStateService, 'syncItemState').mockRejectedValue(new Error('state failed'));
  await expect(service.recoverStaleProcessingRetries()).rejects.toThrow('state failed');
  expect((await rows())[0]).toMatchObject({ status: 'processing', attempts: 0, claim_token: item.claim_token });
});

test('schema migration is repeatable and does not fabricate legacy processing ownership', async () => {
  const migration = await readFile(new URL('../../../../database/migrations/20260929_100000_enrichment_retry_claims.sql', import.meta.url), 'utf8');
  await db.withTransaction(async client => {
    await client.query('CREATE TEMP TABLE enrichment_retry_queue (id integer, status text) ON COMMIT DROP');
    await client.query("INSERT INTO enrichment_retry_queue VALUES (1,'processing'),(2,'pending')");
    await client.query(migration); await client.query(migration);
    expect((await client.query('SELECT * FROM enrichment_retry_queue ORDER BY id')).rows).toEqual([
      { id: 1, status: 'processing', claim_token: null, claim_until: null },
      { id: 2, status: 'pending', claim_token: null, claim_until: null },
    ]);
  });
});
