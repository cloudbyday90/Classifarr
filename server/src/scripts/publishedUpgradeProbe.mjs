/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { assertUpgradeDrillEnvironment, readUpgradeFixture, databaseVersion } from './publishedUpgradeFixtures.mjs';
import { drillRequest, waitFor } from './restoreRecoveryProcess.mjs';
import { readRecoveryState } from './restoreRecoveryFixtures.mjs';

async function login(password) {
  const result = await drillRequest('/api/auth/login', { body: { identifier: 'restore-drill-admin', password } });
  assert.equal(result.status, 200);
  const cookies = result.cookies.map(value => value.split(';')[0]);
  const csrf = cookies.find(value => value.startsWith('classifarr_csrf_token='))?.split('=')[1];
  assert.ok(csrf);
  assert.ok(cookies.some(value => value.startsWith('access_token=')));
  return { cookie: cookies.join('; '), 'x-csrf-token': csrf };
}

export async function runUpgradeProbe(phase) {
  assertUpgradeDrillEnvironment();
  assert.ok(['fresh', 'scheduled', 'scheduled-crash-arm', 'scheduled-crash-ready', 'scheduled-crash-resume',
    'scheduled-crash-budget-arm', 'budget-prepare', 'budget-pressure', 'budget-snapshot',
    'scheduled-backlog-arm', 'scheduled-backlog-ready', 'scheduled-backlog-resume',
    'upgraded', 'interrupt', 'retry', 'handoff', 'normal'].includes(phase));
  const db = await import('../config/database.mjs');
  let blocker;
  try {
    if (phase.startsWith('scheduled-backlog-')) {
      const { armBacklogCrash, verifyBacklogBoundary, verifyBacklogRecovery } = await import('./installationBacklogProbe.mjs');
      if (phase === 'scheduled-backlog-arm') return await armBacklogCrash(db);
      return await (phase === 'scheduled-backlog-ready' ? verifyBacklogBoundary(db) : verifyBacklogRecovery(db));
    }
    if (phase.startsWith('budget-')) {
      const { assertInstallationBudgetEnvironment, prepareInstallationConnectionBudget, readInstallationPressureEvidence }
        = await import('./installationConnectionPressure.mjs');
      assertInstallationBudgetEnvironment();
      if (phase === 'budget-prepare') return await prepareInstallationConnectionBudget(db);
      if (phase === 'budget-pressure') return await readInstallationPressureEvidence();
      const { readStudyCgroup } = await import('./resourceStudyMetrics.mjs');
      const { installationBudgetSnapshot } = await import('./installationBudgetContract.mjs');
      return installationBudgetSnapshot(await readStudyCgroup());
    }
    if (phase === 'fresh') {
      const { verifyFreshInstallation } = await import('./freshInstallationProbe.mjs');
      return await verifyFreshInstallation(db);
    }
    if (phase === 'scheduled') {
      const { runScheduledInstallationProbe } = await import('./scheduledInstallationProbe.mjs');
      return await runScheduledInstallationProbe(db);
    }
    if (phase.startsWith('scheduled-crash-')) {
      const { armScheduledCrash, verifyScheduledCrashBoundary, verifyScheduledCrashRecovery } = await import('./scheduledCrashRecoveryProbe.mjs');
      if (phase === 'scheduled-crash-arm') return await armScheduledCrash(db);
      if (phase === 'scheduled-crash-budget-arm') return await armScheduledCrash(db, { resourceBudget: true });
      return await (phase === 'scheduled-crash-ready' ? verifyScheduledCrashBoundary(db) : verifyScheduledCrashRecovery(db));
    }
    const fixture = await readUpgradeFixture();
    if (phase === 'upgraded') {
      const candidate = await databaseVersion(db);
      assert.ok(candidate.migrations > fixture.baseline.migrations);
      assert.equal((await readRecoveryState(db)).probe, 'before-restore');
      return { baseline: fixture.baseline, candidate };
    }
    if (phase === 'handoff') {
      const { runUpgradeHandoff } = await import('./publishedUpgradeHandoff.mjs');
      return await runUpgradeHandoff(db);
    }
    const session = await login(fixture.password);
    const body = { filename: fixture.filename, mode: 'replace' };
    if (phase === 'normal') {
      assert.equal((await drillRequest('/health')).body.status, 'healthy');
      const denied = await drillRequest('/api/backup/import', { session, body });
      assert.equal(denied.status, 503);
      assert.equal(denied.body.code, 'RESTORE_MODE_REQUIRED');
      assert.equal((await readRecoveryState(db)).receipts, 1);
      const { verifyUpgradeHandoff } = await import('./publishedUpgradeHandoff.mjs');
      return await verifyUpgradeHandoff(db);
    }
    const health = await drillRequest('/health');
    assert.equal(health.body.operatingMode, 'restore');
    assert.equal(health.body.workersActive, false);
    assert.equal((await drillRequest('/api/backup/list')).status, 401);
    assert.equal((await drillRequest('/api/libraries', { session })).status, 503);
    if (phase === 'interrupt') {
      assert.equal((await drillRequest('/api/backup/import', { session: { cookie: session.cookie }, body })).status, 403);
      blocker = await db.pool.connect();
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE settings IN ACCESS EXCLUSIVE MODE');
      const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      let finished = false;
      const pending = drillRequest('/api/backup/import', { session, body, timeout: 60_000 })
        .then(() => { finished = true; }, () => { finished = true; });
      await waitFor(async () => {
        assert.equal(finished, false);
        const blocked = await db.query(`SELECT count(*)::integer AS count FROM pg_stat_activity
          WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))
            AND query LIKE '%INSERT INTO settings%'`, [pid]);
        const gate = await db.query('SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1');
        return gate.rows[0]?.gate_state === 'restore_in_progress' && blocked.rows[0].count === 1;
      }, 'restore_blocked', 20_000);
      await writeFile('/app/data/upgrade-drill/ready-to-kill', 'ready', { mode: 0o600 });
      await pending;
      throw new Error('container_was_not_killed');
    }
    const interrupted = await readRecoveryState(db);
    assert.equal(interrupted.probe, 'before-restore');
    assert.equal(interrupted.late_probe, 'before-restore');
    assert.equal(interrupted.receipts, 0);
    assert.equal(interrupted.gate_state, 'restore_in_progress');
    assert.equal(interrupted.verified_at, null);
    assert.deepEqual(interrupted.libraries, [{ type: 'movie', name: 'Before restore' }, { type: 'tv', name: 'Before restore' }]);
    assert.equal((await drillRequest('/api/backup/import', { session, body })).status, 200);
    const recovered = await readRecoveryState(db);
    assert.equal(recovered.probe, 'backup-value');
    assert.equal(recovered.late_probe, 'backup-value');
    assert.equal(recovered.gate_state, 'ready');
    assert.equal(recovered.reason_id, 'restore_verified');
    assert.ok(recovered.verified_at);
    assert.equal(recovered.receipts, 1);
    assert.deepEqual(recovered.libraries, [{ type: 'movie', name: 'Synthetic Movie Library' }, { type: 'tv', name: 'Synthetic TV Library' }]);
    assert.equal((await drillRequest('/api/libraries', { session })).status, 503);
    return { rollback: 'passed', explicitRetry: 'passed', maintenance: 'passed' };
  } finally {
    if (blocker) { try { await blocker.query('ROLLBACK'); } finally { blocker.release(true); } }
    await db.pool.end();
  }
}
if (import.meta.main) {
  try {
    assert.equal(process.argv.length, 3);
    process.stdout.write(`UPGRADE_PROBE ${JSON.stringify(await runUpgradeProbe(process.argv[2]))}\n`);
  } catch (error) {
    if (process.argv[2] === 'scheduled-backlog-arm') {
      try {
        const { assertInstallationBudgetEnvironment } = await import('./installationConnectionPressure.mjs');
        assertInstallationBudgetEnvironment();
        await writeFile('/app/data/upgrade-drill/unfinished-backfill-failed', 'failed', { flag: 'wx', mode: 0o600 });
      } catch { /* Best effort, fixed marker only; never write outside the guarded drill. */ }
    }
    // Locations help diagnose synthetic assertions without logging values,
    // credentials, backup payloads or provider responses.
    const locations = String(error.stack ?? '').split('\n').filter(line => /^\s+at /.test(line)).slice(0, 5);
    process.stderr.write(`upgrade_probe_failed:${process.argv[2]}\n${locations.join('\n')}\n`);
    process.exitCode = 1;
  }
}
