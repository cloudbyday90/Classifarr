/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createHandoffFixture } from '../helpers/sourceRecoveryHandoffFixture.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { claimEnrichmentRetry, createEnrichmentRetryWriteGuard } from '../../services/enrichmentRetryClaimService.mjs';
import { persistEnrichmentRetryResult } from '../../services/enrichmentRetryResultPersistence.mjs';
import { OMDbLimitReachedError } from '../../services/omdbQuota.mjs';
import { seedOmdbQuotaFixture } from '../helpers/omdbQuotaFixture.mjs';

const db = createIntegrationDatabaseModuleMock();
let fixture, item, service, provider;
function createService() {
  const instance = new EnrichmentRetryService({ db, logger: fixture.log, omdbService: provider });
  jest.spyOn(instance, 'scheduleProcessing').mockImplementation(() => {});
  return instance;
}
beforeEach(async () => {
  await seedOmdbQuotaFixture(db);
  fixture = await createHandoffFixture(db, 'movie'); await fixture.scan();
  item = (await fixture.inventory())[0];
  provider = { getByIMDBId: jest.fn().mockResolvedValue({ Title: 'Evidence', Type: 'movie' }) };
  service = createService(); await service.queueForRetry(item.id, 'omdb');
  expect(fixture.log.error).not.toHaveBeenCalled();
  await db.query('DELETE FROM enrichment_retry_cooldowns');
});
afterEach(async () => { service.cancelScheduledProcessing(); await fixture.cleanup(); await db.query('DELETE FROM enrichment_retry_cooldowns'); });
const row = async () => (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1 ORDER BY id', [item.id])).rows[0];
const due = async () => {
  await db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()-interval '1 second'");
  await db.query("UPDATE enrichment_retry_cooldowns SET next_attempt_at=clock_timestamp()-interval '1 second'");
};
const transient = () => provider.getByIMDBId.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));

test('transient due time survives reconstructed service and manual processing cannot bypass it', async () => {
  transient();
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 1, failed: 1 });
  const before = await row();
  expect(before.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
  expect(before).toMatchObject({ attempts: 1, status: 'pending', claim_token: null });
  service = createService();
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 0 });
  expect(provider.getByIMDBId).toHaveBeenCalledTimes(1);
  expect(await row()).toEqual(before);
  await due(); provider.getByIMDBId.mockResolvedValue({ Title: 'Recovered', Type: 'movie' });
  await service.triggerProcessing();
  expect(await row()).toMatchObject({ status: 'completed', attempts: 1 });
});

test('provider unavailability leaves pending work untouched and recovers when available', async () => {
  await db.query('UPDATE omdb_config SET is_active=false');
  const before = await row();
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 0, skipped: true, failed: 0 });
  expect(provider.getByIMDBId).not.toHaveBeenCalled();
  expect(await row()).toEqual(before);
  expect((await db.query('SELECT * FROM enrichment_retry_cooldowns')).rows).toHaveLength(0);
  await db.query('UPDATE omdb_config SET is_active=true');
  expect(await createService().processRetryQueue(50, 'omdb')).toMatchObject({ success: 1 });
});

test('dependency cooldown blocks other items without blocking another dependency', async () => {
  transient(); await service.processRetryQueue(1, 'omdb');
  await db.query('UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()');
  expect(await claimEnrichmentRetry(db, 'omdb')).toBeNull();
  await service.queueForRetry(item.id, 'web_search');
  expect(await claimEnrichmentRetry(db, 'web_search')).not.toBeNull();
});

test('readiness is rechecked after each successful item, before another network call', async () => {
  const second = (await db.query(`INSERT INTO media_server_items
    (media_server_id, external_id, library_id, media_type, title, imdb_id)
    VALUES ($1, 'second-scheduled-item', $2, 'movie', 'Second', 'tt0000002') RETURNING id`,
  [item.media_server_id, item.library_id])).rows[0];
  await service.queueForRetry(second.id, 'omdb');
  const before = (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [second.id])).rows[0];
  provider.getByIMDBId.mockImplementationOnce(async () => {
    await db.query('UPDATE omdb_config SET requests_today=daily_limit');
    return { Title: 'Last available request', Type: 'movie' };
  });
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 1, success: 1, skipped: true });
  expect(provider.getByIMDBId).toHaveBeenCalledTimes(1);
  expect((await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [second.id])).rows[0]).toEqual(before);
});

test('due monthly legacy work followed by non-quota failure is not deferred another month', async () => {
  await db.query(`UPDATE enrichment_retry_queue SET enrichment_type='tavily', reason='tavily_monthly_quota_deferred',
    last_attempt_at=clock_timestamp()-interval '2 months', next_attempt_at=clock_timestamp()-interval '1 day'`);
  service._webSearchEnrichmentService = { hasAvailableProvider: async () => true };
  jest.spyOn(service, 'enrichWithWebSearch').mockResolvedValue({ success: false, error: 'No usable evidence' });
  expect(await service.processRetryQueue(1, 'tavily')).toMatchObject({ processed: 1, failed: 1 });
  expect(await row()).toMatchObject({ reason: 'Monthly quota wait elapsed', attempts: 1 });
  expect((await row()).next_attempt_at.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
  await due(); expect(await claimEnrichmentRetry(db, 'tavily')).not.toBeNull();
});

test('failed state persistence rolls back schedule, cooldown and retry result atomically', async () => {
  transient();
  jest.spyOn(service.enrichmentItemStateService, 'syncItemState').mockRejectedValue(new Error('fixture state failure'));
  await expect(service.processRetryQueue(1, 'omdb')).rejects.toMatchObject({ reason: 'queue_claim_write_failed' });
  expect(await row()).toMatchObject({ status: 'processing', attempts: 0 });
  expect((await db.query('SELECT * FROM enrichment_retry_cooldowns')).rows).toHaveLength(0);
});

test('enqueue cannot shorten a persisted wait or reset its budget', async () => {
  transient(); await service.processRetryQueue(1, 'omdb');
  const before = await row(); await service.queueForRetry(item.id, 'omdb');
  expect(await row()).toMatchObject({ next_attempt_at: before.next_attempt_at, attempts: 1 });
});

test('pending statistics count durable waits without labelling them actionable', async () => {
  transient(); await service.processRetryQueue(1, 'omdb');
  expect((await service.getStats()).omdb).toMatchObject({ pending: 1, deferred: 1, actionablePending: 0 });
});

test('a web-search cooldown does not defer unrelated TMDb counters', async () => {
  await db.query("UPDATE enrichment_retry_queue SET enrichment_type='tmdb'");
  // Remove existing TMDb evidence so ordinary completion maintenance does not resolve this fixture.
  await db.query("UPDATE media_server_items SET metadata=metadata-'tmdb' WHERE id=$1", [item.id]);
  await db.query("INSERT INTO enrichment_retry_cooldowns VALUES ('web_search', clock_timestamp()+interval '1 hour', 'fixture')");
  expect((await service.getStats()).tmdb).toMatchObject({ pending: 1, deferred: 0, actionablePending: 1 });
});

test('music and disabled libraries do not claim work or call HTTP', async () => {
  const before = await row();
  await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [item.library_id]);
  await service.processRetryQueue(1, 'omdb');
  await db.query('UPDATE libraries SET is_active=true WHERE id=$1', [item.library_id]);
  await db.query("UPDATE media_server_items SET media_type='track' WHERE id=$1", [item.id]);
  await service.processRetryQueue(1, 'omdb');
  expect(await row()).toEqual(before); expect(provider.getByIMDBId).not.toHaveBeenCalled();
});

test('unknown legacy ownership remains untouched despite due time', async () => {
  await db.query("UPDATE enrichment_retry_queue SET status='processing', last_attempt_at=clock_timestamp()-interval '1 year'");
  const before = await row(); await service.triggerProcessing();
  expect(await row()).toEqual(before); expect(provider.getByIMDBId).not.toHaveBeenCalled();
});

test('quota exhausted after admission waits until the next UTC day without fallback', async () => {
  provider.getByIMDBId.mockRejectedValue(new OMDbLimitReachedError('quota race'));
  expect(await service.processRetryQueue(1, 'omdb')).toMatchObject({ failed: 0, skipped: true });
  expect(await row()).toMatchObject({ status: 'pending', attempts: 0, error_message: 'daily_quota' });
  const { rows: [check] } = await db.query(`SELECT next_attempt_at =
    (date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC' AS correct
    FROM enrichment_retry_queue WHERE media_item_id=$1`, [item.id]);
  expect(check.correct).toBe(true);
  expect((await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1', [item.id])).rows).toHaveLength(1);
});

test('concurrent cooldown updates can only extend the existing wait', async () => {
  // Simulate a worker admitted before a different worker published a longer cooldown.
  const received = await claimEnrichmentRetry(db, 'omdb');
  expect(received).not.toBeNull();
  await db.query(`INSERT INTO enrichment_retry_cooldowns VALUES ('omdb', clock_timestamp()+interval '1 day', 'fixture_longer')`);
  await createEnrichmentRetryWriteGuard(db, received, 'omdb')((client, claim, current) =>
    persistEnrichmentRetryResult(client, claim, current, received, 'omdb', { success: false, transient: true, error: 'timeout' },
      { enrichmentItemStateService: service.enrichmentItemStateService }));
  const { rows: [cooldown] } = await db.query('SELECT * FROM enrichment_retry_cooldowns');
  expect(cooldown.reason).toBe('fixture_longer');
  expect(cooldown.next_attempt_at.getTime() - Date.now()).toBeGreaterThan(23 * 3_600_000);
});
