/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, afterEach } from '@jest/globals';
import { setTimeout as delay } from 'node:timers/promises';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';
const db = createIntegrationDatabaseModuleMock();
const { createStudyProviderLoad } = await import('../../scripts/resourceStudyProviderLoad.mjs');
const { seedResourceStudyLibraries } = await import('../../scripts/resourceStudyFixtures.mjs');
const { assertStudyProviderReceipt } = await import('../../scripts/resourceStudyProviderReceipt.mjs');
afterEach(() => jest.restoreAllMocks());

test('real HTTP faults retain waits, recover with production cooldowns and settle unique evidence', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, ...resourceStudyEnvironment });
  const libraries = await seedResourceStudyLibraries(db);
  for (const library of libraries) {
    await db.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type,metadata)
      SELECT l.media_server_id,l.id,l.external_id||'-'||n,'Synthetic '||l.external_id||' '||n,l.media_type,
        '{"content_analysis":{"source":"metadata_enrichment"}}'::jsonb
      FROM libraries l CROSS JOIN generate_series(0,1) n WHERE l.id=$1`, [library.id]);
  }
  let pressure = false, active = 0;
  const logger = { info() {}, warn() {}, debug() {}, error: jest.fn() };
  const study = await createStudyProviderLoad({ db, logger, admission: { tryAcquire: () => {
    if (pressure) return { allowed: false, reason: 'memory_pressure' };
    active++; return { allowed: true, release() { active--; } };
  } } });
  try {
    await study.pass('warmup'); await study.pass('steady'); await study.pass('steady');
    expect(study.receipt.preservedWaitChecks).toBe(2);
    await study.pass('provider_outage'); await study.pass('provider_outage');
    expect((await db.query('SELECT credential_rejected_at FROM omdb_config WHERE is_active')).rows[0].credential_rejected_at).not.toBeNull();
    expect((await db.query('SELECT sum(attempts)::integer n FROM enrichment_retry_queue')).rows[0].n).toBe(0);
    pressure = true; await study.pass('telemetry_pressure'); await study.pass('telemetry_pressure'); pressure = false;
    const deadline = Date.now() + 240000;
    while (study.receipt.recoveryMs === null && Date.now() < deadline) {
      await study.pass('recovery'); await delay(1000);
    }
    const receipt = await study.finish(); expect(() => assertStudyProviderReceipt(receipt)).not.toThrow();
    expect(receipt).toMatchObject({ uniqueCompleted: 8, httpAttempts: 11, chargedAttempts: 2, pending: 0 });
    const snapshot = (await db.query('SELECT * FROM enrichment_retry_queue ORDER BY id')).rows;
    await study.pass('drain'); expect((await db.query('SELECT * FROM enrichment_retry_queue ORDER BY id')).rows).toEqual(snapshot);
    expect((await db.query('SELECT requests_today,is_active FROM omdb_config WHERE is_active')).rows[0])
      .toMatchObject({ requests_today: 11, is_active: true });
    expect(active).toBe(0); expect(logger.error).not.toHaveBeenCalled();
  } finally { await study.close(); }
}, 270000);
