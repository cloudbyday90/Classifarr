/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { runCorpusProfileMeasurements } from '../../scripts/descriptionCorpusProfile/runner.mjs';

test('real corpus, concurrent reads, serialization and held-lock control leave application tables untouched', async () => {
  const pool = getPool(), db = await pool.connect();
  const withClient = async work => { const peer = await pool.connect(); try { return await work(peer); } finally { peer.release(true); } };
  try {
    const report = await runCorpusProfileMeasurements(db, { withClient, size: 500 });
    expect(report.scenarios.map(scenario => scenario.fixture.workload)).toEqual(['sparse', 'all', 'seasons']);
    for (const scenario of report.scenarios) {
      const seasons = scenario.fixture.workload === 'seasons';
      const expectedRows = seasons ? 699 : 499;
      expect(scenario.fixture.expectedRows).toBe(expectedRows);
      expect(scenario.fixture.seasons).toEqual(seasons ? {
        activeMappings: 50, excludedMappings: 2, expectedSeasonRows: 200, evidenceOnlyDocuments: 50,
      } : null);
      expect(scenario.warmup.seasonRows).toBe(seasons ? 200 : 0);
      expect(scenario.cycles).toHaveLength(6);
      for (const cycle of scenario.cycles) {
        expect(cycle.result).toHaveLength(cycle.concurrency);
        expect(cycle.waits.peakCorpusReaders).toBeLessThanOrEqual(cycle.concurrency);
        expect(cycle.result.every(result => result.fingerprint === scenario.warmup.fingerprint && result.rows === expectedRows)).toBe(true);
      }
      expect(scenario.plans.map(plan => plan.mode)).toEqual(['plan', 'serialize']);
      expect(scenario.plans[1].plan.serializationKb).toBeGreaterThan(0);
      expect(scenario.lockControl.code).toBe('55P03');
      expect(scenario.lockControl.waits.categories.Lock).toBeGreaterThan(0);
    }
    expect(report.scenarios[0].warmup.fingerprint).toBe(report.scenarios[1].warmup.fingerprint);
    expect(report.scenarios[2].warmup.fingerprint).not.toBe(report.scenarios[0].warmup.fingerprint);
    expect(report).toMatchObject({ schemaCleanupVerified: true, providerRequests: 0, productionChanges: 0 });
    expect(JSON.stringify(report)).not.toMatch(/Synthetic description|Index Cond|Filter|password|external_id/);
    expect((await db.query('SELECT count(*)::integer AS count FROM public.media_server_items')).rows[0].count).toBe(0);
    expect((await db.query("SELECT to_regnamespace('description_corpus_profile') IS NULL AS clean")).rows[0].clean).toBe(true);
  } finally { db.release(true); }
}, 60000);
