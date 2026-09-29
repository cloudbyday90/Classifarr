/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createHandoffFixture } from '../helpers/sourceRecoveryHandoffFixture.mjs';
import { createProviderRecoveryProbeRepository } from '../../services/providerRecoveryProbeRepository.mjs';
import { createProviderRecoveryProbeService } from '../../services/providerRecoveryProbeService.mjs';
import { providerCredentialContext, rejectProviderCredential } from '../../services/providerCredentialRejection.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { claimEnrichmentRetry } from '../../services/enrichmentRetryClaimService.mjs';

const db = createIntegrationDatabaseModuleMock();
const repository = () => createProviderRecoveryProbeRepository(db, { random: () => 0 });
let fixture, item, retryService;
const omdb = async () => (await db.query('SELECT * FROM omdb_config ORDER BY id DESC LIMIT 1')).rows[0];
const state = async () => (await db.query('SELECT * FROM provider_credential_probes ORDER BY config_id')).rows[0];
const enqueue = async type => { await retryService.queueForRetry(item.id, type); };
async function rejectOmdb() {
  await db.query("INSERT INTO omdb_config(api_key,is_active,daily_limit,requests_today) VALUES ('fixture-only',true,100,0)");
  await rejectProviderCredential(db, providerCredentialContext('omdb', await omdb()));
  await db.query("UPDATE omdb_config SET credential_rejected_at=clock_timestamp()-interval '16 minutes'");
}
async function claimNext(repo = repository()) {
  const candidates = await repo.candidates();
  return candidates[0] ? repo.claim(candidates[0]) : null;
}
beforeEach(async () => {
  await db.query('TRUNCATE web_search_provider_pacing,provider_credential_probes,omdb_config,tavily_config,web_search_provider_config,web_search_provider_usage,enrichment_retry_cooldowns');
  fixture = await createHandoffFixture(db, 'movie'); await fixture.scan(); item = (await fixture.inventory())[0];
  retryService = new EnrichmentRetryService({ db, logger: fixture.log });
  jest.spyOn(retryService, 'scheduleProcessing').mockImplementation(() => {});
});
afterEach(async () => { retryService.cancelScheduledProcessing(); await fixture.cleanup(); });

test('same-key live verification survives restart, preserves item budgets and fences pre-recovery failures', async () => {
  await rejectOmdb(); await enqueue('omdb');
  const old = providerCredentialContext('omdb', await omdb());
  expect(await claimEnrichmentRetry(db, 'omdb')).toBeNull();
  const claim = await claimNext(); expect(claim).not.toBeNull();
  expect((await omdb()).requests_today).toBe(1);
  expect(await repository().finish(claim, { category: 'verified' })).toBe(true);
  const recovered = await omdb(); expect(recovered.api_key).toBe('fixture-only');
  expect(recovered.credential_rejected_at).toBeNull(); expect(recovered.credential_generation).not.toBe(old.generation);
  expect(await rejectProviderCredential(db, old)).toBe(false);
  const work = await claimEnrichmentRetry(db, 'omdb'); expect(work).not.toBeNull(); expect(work.attempts).toBe(0);
  expect((await state()).last_outcome).toBe('verified');
  expect(await repository().finish(claim, { category: 'rejected' })).toBe(false);
});
test('concurrent workers reserve only one probe and one quota unit', async () => {
  await rejectOmdb(); await enqueue('omdb');
  const candidate = (await repository().candidates())[0];
  const claims = await Promise.all([repository().claim(candidate), repository().claim(candidate)]);
  expect(claims.filter(Boolean)).toHaveLength(1); expect((await omdb()).requests_today).toBe(1);
  expect(await claimNext()).toBeNull();
});
test.each(['rotate', 'disable', 'delete', 'expire'])('stale success after %s cannot reopen access', async action => {
  await rejectOmdb(); await enqueue('omdb'); const claim = await claimNext(); expect(claim).not.toBeNull();
  if (action === 'rotate') {
    await db.query("UPDATE omdb_config SET api_key='replacement'");
    await rejectProviderCredential(db, providerCredentialContext('omdb', await omdb()));
  }
  if (action === 'disable') await db.query('UPDATE omdb_config SET is_active=false');
  if (action === 'delete') await db.query('DELETE FROM omdb_config');
  if (action === 'expire') await db.query("UPDATE provider_credential_probes SET lease_until=clock_timestamp()-interval '1 second'");
  expect(await repository().finish(claim, { category: 'verified' })).toBe(false);
  if (['rotate','expire'].includes(action)) expect((await omdb()).credential_rejected_at).not.toBeNull();
  if (action === 'delete') expect(await state()).toBeUndefined();
});
test('crash recovery honors prior backoff, keeps reserved cost and replaces lease', async () => {
  await rejectOmdb(); await enqueue('omdb'); const first = await claimNext();
  await db.query("UPDATE provider_credential_probes SET lease_until=clock_timestamp()-interval '1 second'");
  expect(await claimNext()).toBeNull();
  await db.query("UPDATE provider_credential_probes SET next_probe_at=clock_timestamp()-interval '1 second'");
  const second = await claimNext(); expect(second.token).not.toBe(first.token);
  expect(await repository().finish(first, { category: 'verified' })).toBe(false);
  expect(await repository().finish(second, { category: 'rejected', retryAfterMs: 86400000 })).toBe(true);
  expect((await omdb()).requests_today).toBe(2);
  expect(new Date((await state()).next_probe_at).getTime()).toBeGreaterThan(Date.now() + 86300000);
  expect((await db.query('SELECT attempts FROM enrichment_retry_queue WHERE media_item_id=$1',[item.id])).rows[0].attempts).toBe(0);
});
test('OMDb quota exhaustion prevents HTTP admission and next UTC day permits a reserved probe', async () => {
  await rejectOmdb(); await enqueue('omdb');
  await db.query("UPDATE omdb_config SET requests_today=daily_limit,last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date");
  expect(await claimNext()).toBeNull(); expect((await state()).last_outcome).toBe('quota_wait');
  await db.query("UPDATE omdb_config SET last_reset_date=(clock_timestamp() AT TIME ZONE 'UTC')::date-1");
  await db.query("UPDATE provider_credential_probes SET next_probe_at=clock_timestamp()-interval '1 second'");
  expect(await claimNext()).not.toBeNull(); expect((await omdb()).requests_today).toBe(1);
});
test.each(['empty', 'no_work', 'completed', 'exhausted', 'music', 'disabled_library', 'disabled_server', 'ingesting', 'cooldown'])('%s has no probe demand', async scenario => {
  if (scenario === 'empty') { expect(await repository().candidates()).toEqual([]); return; }
  await rejectOmdb(); if (scenario !== 'no_work') await enqueue('omdb');
  if (scenario === 'completed') await db.query("UPDATE enrichment_retry_queue SET status='completed'");
  if (scenario === 'exhausted') await db.query('UPDATE enrichment_retry_queue SET attempts=max_attempts');
  if (scenario === 'music') await db.query("UPDATE media_server_items SET media_type='music' WHERE id=$1",[item.id]);
  if (scenario === 'disabled_library') await db.query('UPDATE libraries SET is_active=false WHERE id=$1',[fixture.libraryId]);
  if (scenario === 'disabled_server') await db.query('UPDATE media_server SET is_active=false WHERE id=$1',[fixture.serverId]);
  if (scenario === 'ingesting') await db.query("UPDATE library_ingestion_state SET phase='running' WHERE library_id=$1",[fixture.libraryId]);
  if (scenario === 'cooldown') await db.query("INSERT INTO enrichment_retry_cooldowns(dependency,next_attempt_at,reason) VALUES ('omdb',clock_timestamp()+interval '1 hour','test')");
  expect(await claimNext()).toBeNull(); expect((await omdb()).requests_today).toBe(0);
});
test.each(['tavily','brave','serper'])('%s web probes respect soft quotas and recover without modifying items', async provider => {
  await enqueue('web_search');
  const { rows: [config] } = await db.query(`INSERT INTO web_search_provider_config
    (provider_key,display_name,api_key,is_enabled,soft_daily_limit) VALUES ($1,$1,'fixture-only',true,1) RETURNING *`,[provider]);
  await rejectProviderCredential(db, providerCredentialContext('web_search', config));
  await db.query("UPDATE web_search_provider_config SET credential_rejected_at=clock_timestamp()-interval '16 minutes'");
  const claim = await claimNext(); expect(claim).not.toBeNull();
  expect((await db.query('SELECT cost_units,operation FROM web_search_provider_usage')).rows)
    .toEqual([{ cost_units: 1, operation: 'recovery_probe' }]);
  await repository().finish(claim, { category: 'rejected' });
  await db.query("UPDATE provider_credential_probes SET next_probe_at=clock_timestamp()-interval '1 second'");
  expect(await claimNext()).toBeNull();
  await db.query('UPDATE web_search_provider_config SET soft_daily_limit=2');
  await db.query("UPDATE web_search_provider_pacing SET next_admission_at=clock_timestamp()-interval '1 second'");
  await db.query("UPDATE provider_credential_probes SET next_probe_at=clock_timestamp()-interval '1 second'");
  const next = await claimNext(); expect(next).not.toBeNull();
  expect(await repository().finish(next, { category: 'verified', retryAfterMs: 60000 })).toBe(true);
  const { rows: [pacing] } = await db.query('SELECT * FROM web_search_provider_pacing WHERE provider_key=$1', [provider]);
  const { rows: [recovered] } = await db.query('SELECT credential_generation FROM web_search_provider_config WHERE id=$1', [config.id]);
  expect(pacing.credential_generation).toBe(recovered.credential_generation);
  expect(new Date(pacing.blocked_until).getTime()).toBeGreaterThan(Date.now() + 50000);
  expect((await claimEnrichmentRetry(db, 'web_search')).attempts).toBe(0);
});
test('legacy Tavily bridge probes once; an explicit disabled row overrides it', async () => {
  await enqueue('tavily');
  const { rows: [config] } = await db.query("INSERT INTO tavily_config(api_key,is_active) VALUES ('fixture-only',true) RETURNING *");
  await rejectProviderCredential(db, providerCredentialContext('legacy_tavily', config));
  await db.query("UPDATE tavily_config SET credential_rejected_at=clock_timestamp()-interval '16 minutes'");
  const claim = await claimNext(); expect(claim.source).toBe('legacy_tavily');
  await db.query("INSERT INTO web_search_provider_config(provider_key,display_name,is_enabled) VALUES ('tavily','Tavily',false)");
  expect(await repository().finish(claim,{ category:'verified' })).toBe(false);
  expect(await repository().candidates()).toEqual([]);
});
test('changed web options invalidate an in-flight success without clearing rejection', async () => {
  await enqueue('web_search');
  const { rows: [config] } = await db.query(`INSERT INTO web_search_provider_config
    (provider_key,display_name,api_key,is_enabled) VALUES ('tavily','Tavily','fixture-only',true) RETURNING *`);
  await rejectProviderCredential(db, providerCredentialContext('web_search', config));
  await db.query("UPDATE web_search_provider_config SET credential_rejected_at=clock_timestamp()-interval '16 minutes'");
  const claim = await claimNext();
  await db.query(`UPDATE web_search_provider_config SET config='{"projectId":"changed"}'::jsonb`);
  expect(await repository().finish(claim,{ category:'verified' })).toBe(false);
  expect((await db.query('SELECT credential_rejected_at FROM web_search_provider_config')).rows[0].credential_rejected_at).not.toBeNull();
});
test('coordinator recovery makes TV work eligible through ordinary scheduling without resetting budgets', async () => {
  await db.query("UPDATE libraries SET media_type='tv' WHERE id=$1",[fixture.libraryId]);
  await db.query("UPDATE media_server_items SET media_type='tv' WHERE id=$1",[item.id]);
  await rejectOmdb(); await enqueue('omdb');
  const verify = jest.fn(async () => ({ category: 'verified' }));
  const service = createProviderRecoveryProbeService({ db, repository: repository(), verify, logger: fixture.log });
  expect(await service.run()).toEqual({ checked:1,recovered:1 }); expect(verify).toHaveBeenCalledTimes(1);
  expect((await claimEnrichmentRetry(db,'omdb')).attempts).toBe(0);
});
