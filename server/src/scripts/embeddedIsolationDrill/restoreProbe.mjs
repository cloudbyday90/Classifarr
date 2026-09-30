/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import * as db from '../../config/database.mjs';
import { encryptBackupPayload } from '../../services/backupCipher.mjs';
import { waitFor } from '../restoreRecoveryProcess.mjs';
import { assertProbeEnvironment, childEnvironment } from './contract.mjs';

const execute = promisify(execFile);
const options = { cwd: '/app', env: childEnvironment({ admin: true }), shell: false,
  timeout: 200_000, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 };
const password = randomBytes(32).toString('hex');
const backup = { version: '2.0', data: {
  confidenceSettings: [{ setting_key: 'isolation_restore_probe', setting_value: 'restored' }],
  settings: [{ key: 'isolation_restore_probe', value: 'restored' }],
} };
const encrypted = { encrypted: true, data: encryptBackupPayload(backup, password) };

function startRestore(request) {
  const promise = execute('node', ['src/scripts/runDatabaseRestoreMaintenance.mjs', '--apply'], options);
  promise.child.stdin.on('error', () => { /* child result, not an early pipe close, decides success */ });
  promise.child.stdin.end(JSON.stringify(request));
  promise.catch(() => { /* joined by the probe, including injected process termination */ });
  return promise;
}

async function invoke(request, code, expected) {
  let result;
  try { result = await startRestore(request); assert.equal(code, 0); }
  catch (error) { assert.equal(error.code, code); result = error; }
  assert.equal(result.stderr, '');
  // Exact output assertion catches logs, credentials and backup/API-key disclosure.
  assert.equal(result.stdout.trim(), JSON.stringify(expected));
}

async function state() {
  return (await db.query(`SELECT gate_state, reason_id,
    (SELECT count(*)::int FROM policy_backup_restore_verifications) AS receipts,
    (SELECT count(*)::int FROM api_keys) AS keys,
    (SELECT setting_value FROM confidence_settings WHERE setting_key = 'isolation_restore_probe') AS probe
    FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id = 1`)).rows[0];
}

export async function probeRestoreMaintenance() {
  assertProbeEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform }, { admin: true });
  const [phase] = process.argv.slice(2);
  assert(['--busy', '--apply'].includes(phase) && process.argv.length === 3);
  const request = { version: 1, mode: 'merge', backup: encrypted, password };
  const before = await state();
  if (phase === '--busy') {
    await invoke(request, 75, { status: 'deferred', reason: 'normal_runtime_or_maintenance_active' });
    assert.deepEqual(await state(), before);
    return;
  }
  await invoke({ ...request, password: 'incorrect' }, 2, { status: 'rejected', reason: 'invalid_restore_request' });
  assert.deepEqual(await state(), before);

  // A real child dies mid-transaction. Its durable gate, not a timer, blocks normal restart.
  const blocker = await db.pool.connect();
  let attempt;
  try {
    await blocker.query('BEGIN');
    await blocker.query('LOCK TABLE settings IN ACCESS EXCLUSIVE MODE');
    attempt = startRestore(request);
    await waitFor(async () => {
      assert.equal(attempt.child.exitCode, null, 'maintenance_exited_before_fault');
      return (await db.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query LIKE 'INSERT INTO settings%'"))
        .rows[0].count > 0;
    }, 'restore_blocked', 15_000);
    attempt.child.kill('SIGKILL');
    await assert.rejects(attempt, error => error.signal === 'SIGKILL');
  } finally {
    if (attempt && attempt.child.exitCode === null && attempt.child.signalCode === null) attempt.child.kill('SIGKILL');
    if (attempt) await attempt.catch(() => {});
    await blocker.query('ROLLBACK');
    blocker.release(true);
  }
  const interrupted = await state();
  assert.equal(interrupted.gate_state, 'restore_in_progress');
  assert.equal(interrupted.receipts, before.receipts);
  assert.equal(interrupted.probe, before.probe);
  assert.equal(interrupted.keys, before.keys);
  // Even a maintenance credential cannot make the normal entrypoint bypass quarantine.
  await assert.rejects(execute('node', ['src/index.mjs'], {
    ...options, env: { ...childEnvironment({ admin: true }), CLASSIFARR_SCHEMA_MAINTENANCE: 'external' }, timeout: 30_000,
  }), error => error.code === 1 && `${error.stdout}${error.stderr}`.includes('Restore verification is incomplete'));

  for (const mode of ['merge', 'replace']) {
    await invoke({ ...request, mode }, 0, { status: 'complete', reason: 'restore_verified', mode });
    const restored = await state();
    assert.equal(restored.gate_state, 'ready');
    assert.equal(restored.receipts, before.receipts + (mode === 'merge' ? 1 : 2));
    assert.equal(restored.probe, 'restored');
    assert.equal(restored.keys, before.keys, 'headless restore must not mint an undisclosed API key');
  }
  // Older unknown owners are not silently adopted even by a privileged process.
  await db.query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'restore_in_progress', reason_id = 'legacy_owner_unknown', restore_token = gen_random_uuid(), restore_started_at = NOW(), restore_finished_at = NULL, verified_at = NULL WHERE gate_id = 1");
  const legacy = await state();
  await invoke(request, 1, { status: 'failed', reason: 'restore_maintenance_failed' });
  assert.deepEqual(await state(), legacy);
  // This is a synthetic fixture owned by this probe, not permission for production takeover.
  await db.query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'ready', reason_id = 'restore_verified', restore_token = NULL, restore_finished_at = NOW(), verified_at = NOW() WHERE gate_id = 1");
}

if (import.meta.main) {
  try { await probeRestoreMaintenance(); }
  finally { await db.pool.end(); }
}
