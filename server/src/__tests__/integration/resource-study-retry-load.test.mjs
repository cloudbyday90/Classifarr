/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createStudyRetryLoad } from '../../scripts/resourceStudyRetryLoad.mjs';
import { seedResourceStudyLibraries } from '../../scripts/resourceStudyFixtures.mjs';
import { readResourceStudyRetryState, quiesceResourceStudyRetryProviders } from '../../scripts/resourceStudyRetryFixture.mjs';
import { assertStudyRetryReceipt } from '../../scripts/resourceStudyRetryReceipt.mjs';
import { claimEnrichmentRetry } from '../../services/enrichmentRetryClaimService.mjs';

let client, db, pressure, release;
beforeEach(async () => {
  jest.replaceProperty(process, 'env', { ...process.env, CLASSIFARR_UPGRADE_DRILL: 'isolated-compose-v1',
    CLASSIFARR_RESOURCE_STUDY: 'isolated-synthetic-v1', CLASSIFARR_RUNTIME_MODE: 'restore',
    POSTGRES_HOST: 'localhost', POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr',
    BACKUP_DIR: '/app/data/backups', MIGRATIONS_DIR: '/app/database/migrations' });
  client = await getPool().connect(); await client.query('BEGIN');
  db = { query: (...args) => client.query(...args), withTransaction: work => work(client) };
  const libraries = await seedResourceStudyLibraries(db);
  for (const library of libraries) {
    await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,tmdb_id,metadata)
      SELECT l.media_server_id,l.id,'retry-study-'||l.id||'-'||n,'Synthetic retry study',l.media_type,10000+l.id*100+n,'{}'::jsonb
      FROM libraries l CROSS JOIN generate_series(1,20) n WHERE l.id=$1`, [library.id]);
  }
  pressure = false; release = jest.fn();
});
afterEach(async () => { try { await client?.query('ROLLBACK'); } finally { client?.release(); jest.restoreAllMocks(); } });
const load = extra => createStudyRetryLoad({ db, admission: { tryAcquire: () => pressure
  ? { allowed: false, reason: 'memory_pressure' } : { allowed: true, release } }, ...extra });

test('real schema/triggers preserve 60 rows across actual pages, credential rotation and rollback claims', async () => {
  const study = load();
  for (let i = 0; i < 5; i++) await study.pass('steady');
  const original = await readResourceStudyRetryState(db);
  pressure = true; await study.pass('telemetry_pressure'); await study.pass('telemetry_pressure');
  pressure = false; for (let i = 0; i < 5; i++) await study.pass('recovery');
  expect(() => assertStudyRetryReceipt(study.receipt)).toThrow();
  const result = await study.finish(); expect(() => assertStudyRetryReceipt(result)).not.toThrow();
  expect(await readResourceStudyRetryState(db)).toEqual(original);
  expect(original.every(row => row.status === 'pending' && row.claim_token === null && row.attempts === 0)).toBe(true);
  expect(result.types).toMatchObject({ omdb: { recoveredClaims: 5 }, web_search: { recoveredClaims: 5 }, tavily: { recoveredClaims: 5 } });
  await quiesceResourceStudyRetryProviders(db);
  expect(await readResourceStudyRetryState(db)).toEqual(original);
  expect((await db.query('SELECT count(*)::integer n FROM omdb_config WHERE is_active')).rows[0].n).toBe(0);
  expect((await db.query("SELECT count(*)::integer n FROM web_search_provider_config WHERE is_enabled")).rows[0].n).toBe(0);
});

test('an error after claim mutation rolls back the real claim and permits remain balanced', async () => {
  let baseline;
  const study = load({ claim: async (...args) => {
    baseline = await readResourceStudyRetryState(db);
    const item = await claimEnrichmentRetry(...args); expect(item.claim_token).toBeTruthy();
    throw new Error('synthetic_after_claim');
  } });
  await expect(study.pass('steady')).rejects.toThrow('synthetic_after_claim');
  expect(await readResourceStudyRetryState(db)).toEqual(baseline);
  expect(release).toHaveBeenCalledTimes(1);
});

test('changed waiting records cannot produce a passing receipt', async () => {
  const study = load(); await study.pass('steady');
  await db.query("UPDATE enrichment_retry_queue SET attempts=1 WHERE id=(SELECT min(id) FROM enrichment_retry_queue)");
  await expect(study.pass('steady')).rejects.toThrow('state_changed');
  expect(study.receipt.preserved).toBe(false);
});
