/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertDrillEnvironment, seedRecoveryFixtures, readRecoveryState } from './restoreRecoveryFixtures.mjs';
import { drillRequest, startDrillProcess, waitFor, waitForDrillHealth } from './restoreRecoveryProcess.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../utils/backupRestoreSessionContract.mjs';

/** Container-only runner; no production fault injection or arbitrary targets. */
export async function runDrill() {
  assertDrillEnvironment();
  const db = await import('../config/database.mjs');
  const children = [];
  const checks = [];
  let blocker;
  let stage = 'seed';
  const passed = name => { checks.push(name); process.stdout.write(`PASS ${name}\n`); };
  const start = (mode, port = 21324) => {
    const child = startDrillProcess(mode, port);
    children.push(child);
    return child;
  };
  const login = async password => {
    const result = await drillRequest('/api/auth/login', {
      body: { identifier: 'restore-drill-admin', password },
    });
    assert.equal(result.status, 200);
    const cookies = result.cookies.map(value => value.split(';')[0]);
    const csrf = cookies.find(value => value.startsWith('classifarr_csrf_token='))?.split('=')[1];
    assert.ok(csrf);
    assert.ok(cookies.some(value => value.startsWith('access_token=')));
    return { cookie: cookies.join('; '), 'x-csrf-token': csrf };
  };
  try {
    const fixture = await seedRecoveryFixtures(db);
    passed('fresh_synthetic_database');
    stage = 'restore_start';
    let restore = start('restore');
    await waitForDrillHealth(restore, 'restore');
    let session = await login(fixture.password);
    const body = { filename: fixture.filename, mode: 'replace' };
    assert.equal((await drillRequest('/api/backup/list')).status, 401);
    assert.equal((await drillRequest('/api/backup/import', { session: { cookie: session.cookie }, body })).status, 403);
    assert.equal((await drillRequest('/api/libraries', { session })).status, 503);
    passed('maintenance_auth_and_api_boundaries');

    stage = 'interrupt';
    blocker = await db.pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('LOCK TABLE settings IN ACCESS EXCLUSIVE MODE');
    const blockerPid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    let requestFinished = false;
    // Consume rejection immediately: killing the owner deliberately drops HTTP.
    const pending = drillRequest('/api/backup/import', { session, body, timeout: 60_000 })
      .then(result => { requestFinished = true; return result; }, () => { requestFinished = true; return null; });
    await waitFor(async () => {
      if (requestFinished) throw new Error('restore_finished_before_interruption');
      const gate = await db.query(`SELECT gate_state FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1`);
      const blocked = await db.query(`SELECT count(*)::integer AS count FROM pg_stat_activity
        WHERE datname = current_database() AND $1 = ANY(pg_blocking_pids(pid))
          AND query LIKE '%INSERT INTO settings%'`, [blockerPid]);
      return gate.rows[0]?.gate_state === 'restore_in_progress' && blocked.rows[0].count === 1;
    }, 'restore_transaction_blocked', 20_000);
    // Prove normal mode cannot start even while the restore owner is alive.
    await start('normal', 21325).expectRejected('Restore maintenance is active');
    await restore.stop('SIGKILL');
    await pending;
    await blocker.query('ROLLBACK');
    blocker.release();
    blocker = null;
    await waitFor(async () => (await db.query(`SELECT count(*)::integer AS count FROM pg_locks
      WHERE locktype = 'advisory' AND objid = $1`, [RUNTIME_MAINTENANCE_LOCK_KEY])).rows[0].count === 0, 'owner_lock_released');
    const interrupted = await readRecoveryState(db);
    assert.equal(interrupted.probe, 'before-restore');
    assert.equal(interrupted.late_probe, 'before-restore');
    assert.equal(interrupted.receipts, 0);
    assert.deepEqual(interrupted.libraries, [
      { type: 'movie', name: 'Before restore' }, { type: 'tv', name: 'Before restore' },
    ]);
    assert.equal(interrupted.gate_state, 'restore_in_progress');
    assert.equal(interrupted.verified_at, null);
    passed('killed_owner_rolled_back_without_success_receipt');

    stage = 'blocked_restart';
    await start('normal', 21325).expectRejected('Restore verification is incomplete');
    passed('normal_startup_blocked_before_verification');
    stage = 'retry';
    restore = start('restore');
    await waitForDrillHealth(restore, 'restore');
    session = await login(fixture.password);
    const retry = await drillRequest('/api/backup/import', { session, body });
    assert.equal(retry.status, 200);
    assert.match(retry.body.newApiKey, /^clf_[A-Za-z0-9_-]+$/);
    const recovered = await readRecoveryState(db);
    assert.equal(recovered.probe, 'backup-value');
    assert.equal(recovered.late_probe, 'backup-value');
    assert.equal(recovered.gate_state, 'ready');
    assert.equal(recovered.reason_id, 'restore_verified');
    assert.equal(recovered.receipts, 1);
    assert.deepEqual(recovered.libraries, [
      { type: 'movie', name: 'Synthetic Movie Library' }, { type: 'tv', name: 'Synthetic TV Library' },
    ]);
    assert.ok(recovered.verified_at);
    await waitForDrillHealth(restore, 'restore');
    assert.equal((await drillRequest('/api/libraries', { session })).status, 503);
    passed('explicit_retry_verified_and_still_in_maintenance');
    await restore.stop();

    stage = 'normal_restart';
    const normal = start('normal');
    await waitForDrillHealth(normal, 'normal');
    assert.equal((await drillRequest('/api/libraries', { session: { 'x-api-key': retry.body.newApiKey } })).status, 200);
    session = await login(fixture.password);
    const denied = await drillRequest('/api/backup/import', { session, body });
    assert.equal(denied.status, 503);
    assert.equal(denied.body.code, 'RESTORE_MODE_REQUIRED');
    assert.equal((await readRecoveryState(db)).receipts, 1);
    passed('verified_normal_restart_and_restore_disabled');
    return { status: 'passed', checks, scope: 'candidate_node_runtime_configuration_restore' };
  } catch {
    // No backup payload, credentials or child logs in the receipt.
    throw new Error(`recovery_check_failed:${stage}`);
  } finally {
    for (const child of children) await child.stop('SIGKILL');
    if (blocker) {
      try { await blocker.query('ROLLBACK'); }
      finally { blocker.release(true); }
    }
    await db.pool.end();
  }
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 2) throw new Error('drill_arguments_not_allowed');
    process.stdout.write(`RESTORE_DRILL_RESULT ${JSON.stringify(await runDrill())}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
