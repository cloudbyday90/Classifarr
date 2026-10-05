/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { MIGRATION_ROOT, migrationEnvironment } from './identityMigrationDatabase.mjs';

export async function verifySelectedStartup({ signalRuntime = false, cancelStartup = false, restore = false } = {}) {
  const child = spawn(process.execPath, ['src/scripts/embeddedIsolationDrill/identityStartupWorker.mjs',
    ...(signalRuntime ? ['--signal'] : cancelStartup ? ['--cancel-start'] : restore ? ['--restore'] : [])], { cwd: '/app', env: migrationEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', errors = '', signalled = false, lockProbe;
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
  child.stdout.on('data', chunk => {
    output += chunk.toString();
    if (output.length > 8192) child.kill('SIGKILL');
    if (signalRuntime && !signalled && output.includes('selected-startup-ready\n')) {
      signalled = true;
      // A separate process attempts the same lease while runtime is alive.
      lockProbe = assert.rejects(withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {}), /migration_lock_unavailable/)
        .then(() => { child.kill('SIGTERM'); return true; }, () => { child.kill('SIGKILL'); return false; });
    }
  });
  child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-4000); });
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if (signalRuntime) { assert(signalled, 'runtime_readiness_missing'); assert.equal(await lockProbe, true); }
    assert.deepEqual(result, { code: 0, signal: null }, errors);
    assert(output.includes('selected-startup-passed\n'));
    // Completed independent process released the kernel lock after shutdown.
    await withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {});
  } finally { clearTimeout(timer); }
}
