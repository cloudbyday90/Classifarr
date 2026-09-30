/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';
import { reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { deferOmdbPacing, readOmdbPacingReadiness } from '../../services/omdbPacingStore.mjs';
import { createProviderRecoveryProbeRepository } from '../../services/providerRecoveryProbeRepository.mjs';
import { providerCredentialContext } from '../../services/providerCredentialRejection.mjs';

const db = createIntegrationDatabaseModuleMock(), http = jest.fn();
jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../utils/httpClient.mjs', () => ({ httpGet: http,
  httpPost: jest.fn(), httpPut: jest.fn(), httpDelete: jest.fn(), httpGetBinary: jest.fn(),
  httpStream: jest.fn(), defaultHttpClient: { get: http, post: jest.fn() } }));
const { omdbService } = await import('../../services/omdb.mjs');
const { EnrichmentRetryService } = await import('../../services/enrichmentRetryService.mjs');
const { createHandoffFixture } = await import('../helpers/sourceRecoveryHandoffFixture.mjs');
const { summarizeOmdbRetryReadiness } = await import('../../services/omdbRetryReadiness.mjs');
const config = async () => (await db.query('SELECT * FROM omdb_config ORDER BY id DESC LIMIT 1')).rows[0];
const credit = async () => (await config()).requests_today;
const expireFloor = () => db.query("UPDATE omdb_request_pacing SET next_admission_at=clock_timestamp()-interval '1 second'");
const reserve = (database = db) => reserveOmdbQuota(database, { pacing: true });
const instances = [];
let fixture;
function retryService() {
  const service = new EnrichmentRetryService({ db, omdbService, logger: fixture.log });
  jest.spyOn(service, 'scheduleProcessing').mockImplementation(() => {});
  instances.push(service); return service;
}
beforeEach(async () => {
  http.mockReset();
  await seedOmdbQuotaFixture(db);
  await db.query('TRUNCATE provider_credential_probes,enrichment_retry_cooldowns');
});
afterEach(async () => {
  instances.splice(0).forEach(service => service.cancelScheduledProcessing());
  if (fixture) { await fixture.cleanup(); fixture = null; }
});
async function pending() {
  fixture = await createHandoffFixture(db, 'movie');
  await fixture.scan([{ external_id: 'one', title: 'Synthetic fixture', media_type: 'movie', imdb_id: 'tt0000001', tmdb_id: 42 }]);
  const item = (await fixture.inventory())[0];
  await retryService().queueForRetry(item.id, 'omdb');
  return item;
}

test('simultaneous workers admit one request and a reconstructed caller honors the committed floor', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, () => reserve()));
  expect(results.filter(row => row.status === 'reserved')).toHaveLength(1);
  expect(results.filter(row => row.status === 'paced')).toHaveLength(11);
  expect(await credit()).toBe(1);
  expect((await reserve(createIntegrationDatabaseModuleMock())).status).toBe('paced');
  await expireFloor(); expect((await reserve()).status).toBe('reserved'); expect(await credit()).toBe(2);
});
test('rollback undoes quota and timing together', async () => {
  const rolledBack = { withTransaction: work => db.withTransaction(async client => {
    await work(client); throw new Error('rollback fixture');
  }) };
  await expect(reserve(rolledBack)).rejects.toThrow('rollback fixture');
  expect(await credit()).toBe(0); expect((await db.query('SELECT * FROM omdb_request_pacing')).rows).toEqual([]);
  expect((await reserve()).status).toBe('reserved');
});
test('a busy configuration times out without spending or sending HTTP', async () => {
  const item = await pending();
  const blocker = await getPool().connect();
  try {
    await blocker.query('BEGIN'); await blocker.query('LOCK TABLE omdb_config IN SHARE ROW EXCLUSIVE MODE');
    expect(await retryService().processRetryQueue(1, 'omdb')).toMatchObject({ processed: 1, failed: 0, skipped: true });
    expect(http).not.toHaveBeenCalled();
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
  expect(await credit()).toBe(0); expect((await db.query('SELECT * FROM omdb_request_pacing')).rows).toEqual([]);
  const rows = (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [item.id])).rows;
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ status: 'pending', attempts: 0 });
  expect(new Date(rows[0].next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 50000);
});
test('credential replacement releases old long waits, preserves the floor and rejects late observations', async () => {
  const first = await reserve(); await deferOmdbPacing(db, first.credentialContext, 3600);
  await db.query("UPDATE omdb_config SET api_key='replacement-fixture'");
  await deferOmdbPacing(db, first.credentialContext, 7200);
  expect((await reserve()).status).toBe('paced');
  await expireFloor(); expect((await reserve()).status).toBe('reserved');
  const before = await credit();
  expect((await reserveOmdbQuota(db, { pacing: true, expectedContext: first.credentialContext })).status).toBe('lookup_restart');
  expect(await credit()).toBe(before);
});
test('readiness observes waits in a read-only transaction without exposing credentials or spending', async () => {
  const first = await reserve(); await deferOmdbPacing(db, first.credentialContext, 120);
  const before = await credit();
  await db.withTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    const pace = await readOmdbPacingReadiness(client);
    expect(pace.wait).toBeGreaterThan(110);
    const report = await summarizeOmdbRetryReadiness(client,
      { rows: [{ item_eligible: true, candidate: true, title: 'Synthetic' }] }, Date.now());
    expect(report.quota.status).toBe('available');
    expect(report.counts.provider_wait).toBe(1);
    expect(Date.parse(report.earliestRetryAt)).toBeGreaterThan(Date.now() + 110000);
    expect(JSON.stringify(report)).not.toMatch(/synthetic|credential_generation/);
  });
  expect(await credit()).toBe(before);
});
test.each(['disabled', 'exhausted', 'unconfigured'])('%s setup never creates timing or makes HTTP', async state => {
  if (state === 'disabled') await db.query('UPDATE omdb_config SET is_active=false');
  if (state === 'exhausted') await db.query('UPDATE omdb_config SET requests_today=daily_limit');
  if (state === 'unconfigured') await db.query('TRUNCATE omdb_config');
  await expect(omdbService.getByTitle('Synthetic fixture', 2026, 'movie')).rejects.toBeDefined();
  expect(http).not.toHaveBeenCalled(); expect((await db.query('SELECT * FROM omdb_request_pacing')).rows).toEqual([]);
});
test('retry restart resumes title after a committed IMDb miss without another credit, attempt or fallback', async () => {
  const item = await pending();
  http.mockResolvedValueOnce({ status: 200, data: { Response: 'False', Error: 'Movie not found!' } })
    .mockResolvedValueOnce({ status: 200, data: { Response: 'True', Title: 'Synthetic fixture', imdbID: 'tt0000001', Type: 'movie', Ratings: [] } });
  await retryService().processRetryQueue(1, 'omdb');
  const first = (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [item.id])).rows[0];
  expect(first).toMatchObject({ status: 'pending', attempts: 0 });
  expect(first.omdb_lookup_checkpoint.version).toBe(1); expect(await credit()).toBe(1);
  expect(http).toHaveBeenCalledTimes(1);
  await expireFloor();
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [first.id]);
  await retryService().processRetryQueue(1, 'omdb');
  const rows = (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [item.id])).rows;
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ status: 'completed', attempts: 0, omdb_lookup_checkpoint: null });
  expect(await credit()).toBe(2); expect(http).toHaveBeenCalledTimes(2);
  expect(http.mock.calls[0][1].params.i).toBe('tt0000001'); expect(http.mock.calls[1][1].params.t).toBe('Synthetic fixture');
});
test('recovery probes share lookup pacing and transfer same-key wait evidence on verification', async () => {
  await pending();
  const first = await reserve();
  await db.query("UPDATE omdb_request_pacing SET next_admission_at=clock_timestamp()+interval '10 seconds'");
  await db.query("UPDATE omdb_config SET credential_rejected_at=clock_timestamp()-interval '16 minutes'");
  const repository = createProviderRecoveryProbeRepository(db, { random: () => 0 });
  const candidate = (await repository.candidates())[0];
  expect(await repository.claim(candidate)).toBeNull(); expect(await credit()).toBe(1);
  await expireFloor(); await db.query("UPDATE provider_credential_probes SET next_probe_at=clock_timestamp()-interval '1 second'");
  const claim = await repository.claim(candidate); expect(claim).not.toBeNull(); expect(await credit()).toBe(2);
  await deferOmdbPacing(db, first.credentialContext, 1800);
  expect(await repository.finish(claim, { category: 'verified', retryAfterMs: 60000 })).toBe(true);
  const current = providerCredentialContext('omdb', await config()); expect(current.generation).not.toBe(first.credentialContext.generation);
  expect((await readOmdbPacingReadiness(db)).wait).toBeGreaterThan(1700);
  await deferOmdbPacing(db, first.credentialContext, 7200);
  expect((await readOmdbPacingReadiness(db)).wait).toBeLessThanOrEqual(1800);
  expect((await reserve()).status).toBe('paced'); expect(await credit()).toBe(2);
});
test('credential rotation discards a saved continuation without charging or sending an obsolete title request', async () => {
  const item = await pending();
  http.mockResolvedValue({ status: 200, data: { Response: 'False', Error: 'Movie not found!' } });
  await retryService().processRetryQueue(1, 'omdb');
  expect(await credit()).toBe(1); expect(http).toHaveBeenCalledTimes(1);
  await db.query("UPDATE omdb_config SET api_key='replacement-fixture'"); await expireFloor();
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE media_item_id=$1", [item.id]);
  await retryService().processRetryQueue(1, 'omdb');
  const rows = (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [item.id])).rows;
  expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ status: 'pending', attempts: 0, omdb_lookup_checkpoint: null });
  expect(await credit()).toBe(1); expect(http).toHaveBeenCalledTimes(1);
});
test('provider Retry-After from a real lookup path blocks subsequent callers without another HTTP attempt', async () => {
  http.mockRejectedValue({ response: { status: 429, headers: { 'Retry-After': '120' } } });
  await expect(omdbService.getByIMDBId('tt0000001', undefined, { queueOwned: true })).rejects.toMatchObject({ retryAfterSeconds: 120 });
  await expect(omdbService.getByTitle('Other', 2026, 'movie')).rejects.toMatchObject({ code: 'OMDB_ADMISSION_WAIT' });
  expect(http).toHaveBeenCalledTimes(1); expect(await credit()).toBe(1);
});
