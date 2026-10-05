/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { startSelectedMaintenance } from '../../bootstrap/embeddedSelectedMaintenance.mjs';
import { observeEmbeddedMaintenance } from '../../bootstrap/embeddedMaintenanceOutput.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../../utils/backupRestoreSessionContract.mjs';
import { encryptBackupPayload } from '../../services/backupCipher.mjs';
import { waitFor } from '../restoreRecoveryProcess.mjs';
import { assertDrillEnvironment } from './contract.mjs';
import { MIGRATION_ROOT, MIGRATION_SOCKET, MIGRATION_DATABASE, migrationEnvironment,
  migrationSql, databaseIdentity, candidateStart, candidateStop } from './identityMigrationDatabase.mjs';

const scalar = async sql => (await migrationSql(sql)).stdout.trim();
const state = async () => JSON.parse(await scalar(`SELECT json_build_object('gate',gate_state,
  'receipts',(SELECT count(*) FROM policy_backup_restore_verifications),
  'value',(SELECT value FROM settings WHERE key='selected_restore_probe'))
  FROM policy_native_intent_reconciliation_restore_gates WHERE gate_id=1`));

async function withBlocker(kind, work) {
  const sql = kind === 'runtime' ? `SELECT pg_advisory_lock(${RUNTIME_MAINTENANCE_LOCK_KEY})`
    : 'LOCK TABLE settings IN ACCESS EXCLUSIVE MODE';
  const child = spawn('/sbin/su-exec', ['postgres', '/usr/bin/psql', '-X', '-v', 'ON_ERROR_STOP=1',
    '-h', MIGRATION_SOCKET, '-U', 'classifarr', '-d', MIGRATION_DATABASE,
    '-c', `BEGIN; ${sql}; SELECT pg_sleep(90); ROLLBACK;`], {
    cwd: '/app', shell: false, env: { ...migrationEnvironment(), PGAPPNAME: 'selected-maintenance-blocker' },
    stdio: ['pipe', 'pipe', 'pipe'], timeout: 95_000, killSignal: 'SIGKILL',
  });
  const observed = observeEmbeddedMaintenance(child);
  try {
    await waitFor(async () => {
      assert(!observed.hasExited(), 'selected_blocker_exited');
      return await scalar("SELECT count(*) FROM pg_stat_activity WHERE application_name='selected-maintenance-blocker' AND wait_event='PgSleep'") === '1';
    }, 'selected_blocker_ready', 10_000);
    await work();
  } finally {
    // A disconnected psql can leave pg_sleep running until its query finishes.
    // Terminate only this labelled synthetic backend in the disposable database.
    try { await scalar("SELECT pg_terminate_backend(pid,5000) FROM pg_stat_activity WHERE application_name='selected-maintenance-blocker' AND datname='classifarr' AND usename='classifarr' AND pid<>pg_backend_pid()"); }
    finally { observed.signal('SIGTERM'); await observed.done; }
    await waitFor(async () => await scalar("SELECT count(*) FROM pg_stat_activity WHERE application_name='selected-maintenance-blocker'") === '0',
      'selected_blocker_drained', 10_000);
  }
}

/** Caller already verified network-none, empty disposable volumes and root layout. */
export async function verifySelectedMaintenance() {
  assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {
    const identity = await databaseIdentity();
    await candidateStart();
    const password = randomBytes(32).toString('hex');
    const backup = { encrypted: true, data: encryptBackupPayload({ version: '2.0',
      data: { settings: [{ key: 'selected_restore_probe', value: 'restored' }] } }, password) };
    const invoke = async (operation, expected, options = {}) => {
      const result = await startSelectedMaintenance({ operation, identity, ...options }).done;
      assert.deepEqual(result, { code: expected, signal: null });
    };
    const request = Buffer.from(JSON.stringify({ version: 1, mode: 'merge', backup, password }));
    try {
      await invoke('schema', 0);
      const before = await state();
      await invoke('schema', 1, { identity: { uid: 1000, gid: 1000 } });
      const malformed = Buffer.from(JSON.stringify({ version: 1, mode: 'merge', backup, password: 'incorrect' }));
      try { await invoke('restore', 2, { request: malformed }); }
      finally { malformed.fill(0); }
      await withBlocker('runtime', async () => {
        await invoke('schema', 75);
        await invoke('restore', 75, { request });
      });
      assert.deepEqual(await state(), before);
      await withBlocker('settings', async () => {
        const attempt = startSelectedMaintenance({ operation: 'restore', identity, request });
        try {
          await waitFor(async () => {
            assert(!attempt.hasExited(), 'selected_restore_exited_before_fault');
            return await scalar("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'INSERT INTO settings%'") === '1';
          }, 'selected_restore_blocked', 10_000);
          attempt.signal('SIGKILL');
          assert.equal((await attempt.done).signal, 'SIGKILL');
        } finally { if (!attempt.hasExited()) attempt.signal('SIGKILL'); await attempt.done; }
      });
      assert.deepEqual(await state(), { ...before, gate: 'restore_in_progress' });
      const diagnostics = [];
      await invoke('schema', 78, { report: (...args) => diagnostics.push(args) });
      assert.equal(diagnostics[0]?.[1], 'restore_verification_required');
      for (const mode of ['merge', 'replace']) {
        const next = Buffer.from(JSON.stringify({ version: 1, mode, backup, password }));
        try { await invoke('restore', 0, { request: next }); }
        finally { next.fill(0); }
        assert.deepEqual(await state(), { gate: 'ready', value: 'restored', receipts: before.receipts + (mode === 'merge' ? 1 : 2) });
        await invoke('schema', 0);
      }
    } finally { request.fill(0); await candidateStop(); }
  });
}
