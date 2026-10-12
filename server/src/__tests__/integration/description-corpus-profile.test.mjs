/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { runCorpusProfileMeasurements } from '../../scripts/descriptionCorpusProfile/runner.mjs';

test('real corpus, concurrent reads, serialization and held-lock control leave application tables untouched', async () => {
  const pool = getPool(), db = await pool.connect();
  const withClient = async work => { const peer = await pool.connect(); try { return await work(peer); } finally { peer.release(true); } };
  try {
    const report = await runCorpusProfileMeasurements(db, { withClient, size: 500 });
    expect(report.scenarios).toHaveLength(2);
    for (const scenario of report.scenarios) {
      expect(scenario.fixture.expectedRows).toBe(499);
      expect(scenario.cycles).toHaveLength(6);
      for (const cycle of scenario.cycles) {
        expect(cycle.result).toHaveLength(cycle.concurrency);
        expect(cycle.result.every(result => result.fingerprint === scenario.warmup.fingerprint && result.rows === 499)).toBe(true);
      }
      expect(scenario.plans.map(plan => plan.mode)).toEqual(['plan', 'serialize']);
      expect(scenario.plans[1].plan.serializationKb).toBeGreaterThan(0);
      expect(scenario.lockControl.code).toBe('55P03');
      expect(scenario.lockControl.waits.categories.Lock).toBeGreaterThan(0);
    }
    expect(report).toMatchObject({ schemaCleanupVerified: true, providerRequests: 0, productionChanges: 0 });
    expect(JSON.stringify(report)).not.toMatch(/Synthetic description|Index Cond|Filter|password|external_id/);
    expect((await db.query('SELECT count(*)::integer AS count FROM public.media_server_items')).rows[0].count).toBe(0);
    expect((await db.query("SELECT to_regnamespace('description_corpus_profile') IS NULL AS clean")).rows[0].clean).toBe(true);
  } finally { db.release(true); }
}, 60000);
