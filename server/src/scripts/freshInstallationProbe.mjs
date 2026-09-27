/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { assertUpgradeDrillEnvironment, databaseVersion } from './publishedUpgradeFixtures.mjs';
import { drillRequest } from './restoreRecoveryProcess.mjs';

/** Read-only probe, exclusively inside the disposable installation drill. */
export async function verifyFreshInstallation(db, { request = drillRequest,
  readMigrations = () => readdir('/app/database/migrations') } = {}) {
  assertUpgradeDrillEnvironment();
  assert.equal((await request('/health')).body.status, 'healthy');
  assert.equal((await request('/api/system/health/ready')).status, 200);
  const expected = (await readMigrations()).filter(name => name.endsWith('.sql')).sort();
  assert.ok(expected.length > 0);
  const applied = (await db.query('SELECT filename FROM schema_migrations')).rows.map(row => row.filename).sort();
  assert.deepEqual(applied, expected);
  const gate = await db.query(`SELECT gate_id,gate_state,reason_id,restore_token,verified_at
    FROM policy_native_intent_reconciliation_restore_gates`);
  assert.deepEqual(gate.rows, [{ gate_id: 1, gate_state: 'ready', reason_id: 'startup_ready',
    restore_token: null, verified_at: null }]);
  const seeds = (await db.query(`SELECT
    (SELECT count(*)::integer FROM library_observation_sampling_state WHERE singleton=true) AS sampling,
    (SELECT count(*)::integer FROM ai_provider_config WHERE id=1 AND primary_provider='none') AS provider,
    (SELECT count(*)::integer FROM pattern_analysis_config WHERE id=1) AS patterns,
    (SELECT count(*)::integer FROM embedding_provider_availability WHERE id=1) AS embedding,
    (SELECT count(*)::integer FROM settings WHERE key='csrf_protection' AND value='true') AS csrf,
    (SELECT count(*)::integer FROM settings WHERE key='error_log_retention_days' AND value='90') AS retention,
    (SELECT count(*)::integer FROM users) AS users,
    (SELECT count(*)::integer FROM libraries) AS libraries,
    (SELECT count(*)::integer FROM policy_backup_restore_verifications) AS receipts`)).rows[0];
  assert.deepEqual(seeds, { sampling: 1, provider: 1, patterns: 1, embedding: 1, csrf: 1,
    retention: 1, users: 0, libraries: 0, receipts: 0 });
  return { status: 'passed', database: await databaseVersion(db) };
}
