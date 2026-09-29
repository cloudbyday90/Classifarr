/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { providerCredentialContext, rejectProviderCredential } from '../../services/providerCredentialRejection.mjs';
import { readOmdbQuota, reserveOmdbQuota } from '../../services/omdbQuotaStore.mjs';
import { WebSearchProviderStorage } from '../../services/webSearchProviderStorage.mjs';
import { evaluateWebSearchProviderRouteCandidate } from '../../services/webSearchProviderQuotaPolicy.mjs';
import { EnrichmentRetryService } from '../../services/enrichmentRetryService.mjs';
import { createHandoffFixture } from '../helpers/sourceRecoveryHandoffFixture.mjs';
import { claimEnrichmentRetry } from '../../services/enrichmentRetryClaimService.mjs';
import { persistMetadataProviderConfig } from '../../services/metadataProviderConfigStore.mjs';
import { buildOmdbConfigMutationPayload } from '../../routes/helpers/metadataProviderSettingsSupport.mjs';

const db = createIntegrationDatabaseModuleMock();
let fixture, service, item, provider;
const config = async () => (await db.query('SELECT * FROM omdb_config ORDER BY id DESC LIMIT 1')).rows[0];
const retry = async () => (await db.query('SELECT * FROM enrichment_retry_queue WHERE media_item_id=$1 ORDER BY id', [item.id])).rows[0];
beforeEach(async () => {
  await db.query('TRUNCATE omdb_config, tavily_config, web_search_provider_config');
  await db.query('DELETE FROM enrichment_retry_cooldowns');
  fixture = await createHandoffFixture(db, 'movie'); await fixture.scan();
  item = (await fixture.inventory())[0];
  provider = { hasRemainingQuota: async () => ({ available: (await readOmdbQuota(db)).status === 'available' }),
    getByIMDBId: jest.fn(async () => {
      const reservation = await reserveOmdbQuota(db);
      expect(reservation.status).toBe('reserved');
      await rejectProviderCredential(db, reservation.credentialContext);
      throw Object.assign(new Error('rejected'), { code: 'OMDB_AUTHENTICATION' });
    }) };
  service = new EnrichmentRetryService({ db, logger: fixture.log, omdbService: provider });
  jest.spyOn(service, 'scheduleProcessing').mockImplementation(() => {});
});
afterEach(async () => { service.cancelScheduledProcessing(); await fixture.cleanup(); });
const insertOmdb = () => db.query("INSERT INTO omdb_config(api_key, is_active, daily_limit, requests_today) VALUES ('fixture-key-A', true, 100, 0)");
const due = () => db.query("UPDATE enrichment_retry_queue SET next_attempt_at=clock_timestamp()-interval '1 second'");

test('rejected credentials preserve every item budget, block manual/automatic claims and recover after rotation', async () => {
  await insertOmdb();
  await service.queueForRetry(item.id, 'omdb');
  expect(await service.processRetryQueue(50, 'omdb')).toMatchObject({ processed: 1, failed: 0, skipped: true });
  expect(await retry()).toMatchObject({ status: 'pending', attempts: 0, error_message: 'provider_credentials_rejected' });
  await due(); await db.query('DELETE FROM enrichment_retry_cooldowns');
  const before = await retry();
  expect(await claimEnrichmentRetry(db, 'omdb')).toBeNull();
  const restarted = new EnrichmentRetryService({ db, logger: fixture.log, omdbService: provider });
  await restarted.triggerProcessing();
  expect(await retry()).toEqual(before); expect(provider.getByIMDBId).toHaveBeenCalledTimes(1);
  expect((await restarted.getStats()).omdb).toMatchObject({ pending: 1, deferred: 1, actionablePending: 0 });
  expect((await config()).requests_today).toBe(1);
  await db.query("UPDATE omdb_config SET api_key='fixture-key-B'");
  provider.getByIMDBId.mockResolvedValue({ Title: 'Recovered' });
  await restarted.triggerProcessing();
  expect(await retry()).toMatchObject({ status: 'completed', attempts: 0 });
  expect((await config()).requests_today).toBe(1);
});

test('same-key settings and quota changes cannot clear a pause; A-B-A rejects stale generations', async () => {
  await insertOmdb(); const initial = providerCredentialContext('omdb', await config());
  expect(await rejectProviderCredential(db, initial)).toBe(true);
  const rejected = await config();
  await db.withTransaction(client => persistMetadataProviderConfig(client, 'omdb',
    existing => buildOmdbConfigMutationPayload({ daily_limit: 150 }, existing)));
  expect(await config()).toMatchObject({ credential_generation: initial.generation, credential_rejected_at: rejected.credential_rejected_at });
  await db.query("UPDATE omdb_config SET api_key='fixture-key-B'");
  await db.query("UPDATE omdb_config SET api_key='fixture-key-A'");
  expect((await config()).credential_generation).not.toBe(initial.generation);
  expect(await rejectProviderCredential(db, initial)).toBe(false);
  expect((await readOmdbQuota(db)).status).toBe('available');
});

test('late failure after concurrent rotation cannot reject a new generation', async () => {
  await insertOmdb(); const initial = providerCredentialContext('omdb', await config());
  await Promise.all([rejectProviderCredential(db, initial), db.query("UPDATE omdb_config SET api_key='rotated'")]);
  expect((await config()).credential_rejected_at).toBeNull();
  expect(await rejectProviderCredential(db, initial)).toBe(false);
});

test('rejected admission does not reserve quota; explicit disable/re-enable permits a new attempt', async () => {
  await insertOmdb(); await rejectProviderCredential(db, providerCredentialContext('omdb', await config()));
  expect((await reserveOmdbQuota(db)).status).toBe('credentials_rejected');
  expect((await config()).requests_today).toBe(0);
  await db.query('UPDATE omdb_config SET is_active=false');
  expect((await reserveOmdbQuota(db)).status).toBe('not_configured');
  await db.query('UPDATE omdb_config SET is_active=true');
  expect((await reserveOmdbQuota(db)).status).toBe('reserved');
});

test('fresh setup remains unconfigured without manufacturing blocked credentials', async () => {
  expect((await readOmdbQuota(db)).status).toBe('not_configured');
  expect((await db.query('SELECT * FROM enrichment_provider_credential_status')).rows).toEqual([]);
});

test('web rejection is provider-scoped, masked externally and survives telemetry and no-op saves', async () => {
  const storage = new WebSearchProviderStorage({ db, healthHistory: null });
  const input = { providerKey: 'brave', apiKey: 'brave-fixture', isEnabled: true };
  const saved = await storage.upsertProviderConfig(input, { maskSecrets: false });
  // Migration provenance on a real provider row must not redirect writes to legacy storage.
  await db.query("UPDATE web_search_provider_config SET legacy_source='tavily_config' WHERE provider_key='brave'");
  expect((await storage.getProviderConfig('brave', { maskSecrets: false })).credentialContext.source).toBe('web_search');
  await storage.upsertProviderConfig({ providerKey: 'serper', apiKey: 'serper-fixture', isEnabled: true });
  await storage.rejectCredential(saved.credentialContext);
  await storage.updateProviderAfterUsage('brave', { status: 'success' });
  await storage.upsertProviderConfig(input);
  const publicConfig = await storage.getProviderConfig('brave');
  expect(publicConfig.credentialsRejected).toBe(true);
  expect(publicConfig).not.toHaveProperty('credentialContext');
  expect(JSON.stringify(publicConfig)).not.toContain('brave-fixture');
  const current = await storage.getProviderConfig('brave', { maskSecrets: false });
  expect(evaluateWebSearchProviderRouteCandidate({ config: current, adapter: {} }).skipReason).toBe('credentials_rejected');
  await service.queueForRetry(item.id, 'web_search');
  expect(await claimEnrichmentRetry(db, 'web_search')).not.toBeNull();
  await storage.upsertProviderConfig({ ...input, apiKey: 'brave-rotated' });
  expect(await storage.rejectCredential(saved.credentialContext)).toBe(false);
  expect((await storage.getProviderConfig('brave')).credentialsRejected).toBe(false);
});

test('all rejected web candidates defer claims including legacy Tavily; unrelated TMDb remains actionable', async () => {
  await db.query("INSERT INTO tavily_config(api_key, is_active) VALUES ('legacy-fixture', true)");
  const storage = new WebSearchProviderStorage({ db, healthHistory: null });
  const legacy = await storage.getLegacyTavilyConfig({ maskSecrets: false });
  expect(legacy.credentialContext.source).toBe('legacy_tavily');
  await storage.rejectCredential(legacy.credentialContext);
  await service.queueForRetry(item.id, 'web_search');
  expect(await claimEnrichmentRetry(db, 'web_search')).toBeNull();
  expect((await service.getStats()).web_search).toMatchObject({ deferred: 1, actionablePending: 0 });
  await db.query("UPDATE enrichment_retry_queue SET enrichment_type='tmdb'");
  await db.query("UPDATE media_server_items SET metadata=metadata-'tmdb' WHERE id=$1", [item.id]);
  expect((await service.getStats()).tmdb).toMatchObject({ deferred: 0, actionablePending: 1 });
  await db.query("UPDATE enrichment_retry_queue SET enrichment_type='tavily'");
  await db.query("UPDATE tavily_config SET api_key='legacy-corrected'");
  expect(await storage.rejectCredential(legacy.credentialContext)).toBe(false);
  expect(await claimEnrichmentRetry(db, 'tavily')).not.toBeNull();
});

test('a disabled explicit Tavily config still overrides the legacy bridge', async () => {
  await db.query("INSERT INTO tavily_config(api_key, is_active) VALUES ('legacy-fixture', true)");
  const storage = new WebSearchProviderStorage({ db, healthHistory: null });
  await storage.upsertProviderConfig({ providerKey: 'tavily', isEnabled: false });
  expect((await db.query('SELECT * FROM enrichment_provider_credential_status')).rows).toEqual([]);
});
