/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, chown, chmod, readFile, readdir, writeFile, lstat, symlink, unlink, link } from 'node:fs/promises';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { inspectMigrationTree, digestMigrationTree } from '../../bootstrap/embeddedMigrationTree.mjs';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { SOURCE, MIGRATION_ROOT, MIGRATION_SOCKET, MIGRATION_DATABASE, migrationEnvironment,
  migrationCommand, migrationSql } from './identityMigrationDatabase.mjs';
import { verifySelectedStartup } from './identityStartupProbe.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assert.equal(process.argv.length, 2);
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
assert.equal((await readdir('/identity-migration')).length, 0);
await chmod('/identity-migration', 0o755);
for (const path of [SOURCE, MIGRATION_SOCKET]) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed directories in the disposable migration volume
  await mkdir(path, { mode: 0o700 });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- synthesize the legacy shared OS ownership
  await chown(path, 1000, 1000);
}
await migrationCommand('classifarr', 'initdb', ['-D', SOURCE, '-U', 'classifarr', '--auth-local=trust', '--auth-host=reject', '--encoding=UTF8', '--locale=C']);
await writeFile('/identity-migration/source/postgresql.auto.conf', `listen_addresses=''\nunix_socket_directories='${MIGRATION_SOCKET}'\nshared_preload_libraries='pg_stat_statements'\nshared_buffers='32MB'\nmax_connections=20\n`);
await migrationCommand('classifarr', 'pg_ctl', ['-D', SOURCE, '-l', `${SOURCE}/legacy.log`, '-w', 'start']);
try {
  await migrationCommand('classifarr', 'createdb', ['-h', MIGRATION_SOCKET, '-U', 'classifarr', MIGRATION_DATABASE]);
  await migrationCommand('classifarr', 'node', ['src/scripts/runDatabaseSchemaMaintenance.mjs', '--apply']);
  await migrationSql("ALTER ROLE classifarr PASSWORD 'synthetic_previous_password'; CREATE TABLE migration_sentinel(id integer PRIMARY KEY,value text); INSERT INTO migration_sentinel VALUES(1,'preserved');", 'classifarr');
} finally { await migrationCommand('classifarr', 'pg_ctl', ['-D', SOURCE, '-m', 'fast', '-w', 'stop']); }

const originalDigest = await digestMigrationTree(SOURCE, await inspectMigrationTree(SOURCE));
await symlink('/etc/passwd', '/identity-migration/source/unsupported-link');
await assert.rejects(inspectMigrationTree(SOURCE), /migration_tree_unsupported/);
await unlink('/identity-migration/source/unsupported-link');
await link('/identity-migration/source/PG_VERSION', '/identity-migration/source/unsupported-hardlink');
await assert.rejects(inspectMigrationTree(SOURCE), /migration_tree_unsupported/);
await unlink('/identity-migration/source/unsupported-hardlink');
await withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {
  await assert.rejects(withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {}), /migration_lock_unavailable/);
});

async function worker(fault, selection = false) {
  const script = selection ? 'identitySelectionWorker.mjs' : 'identityMigrationWorker.mjs';
  const child = spawn(process.execPath, [`src/scripts/embeddedIsolationDrill/${script}`, ...(fault ? [fault] : [])], {
    cwd: '/app', env: migrationEnvironment(), stdio: ['ignore', 'pipe', 'pipe'],
  });
  let killed = false, output = '';
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
  child.stdout.on('data', chunk => {
    output += chunk.toString();
    if (output.length > 8192) child.kill('SIGKILL');
    if (fault && output.includes('migration-fault-ready\n') && !killed) { killed = true; child.kill('SIGKILL'); }
  });
  let errorText = '';
  child.stderr.on('data', chunk => { errorText = (errorText + chunk.toString()).slice(-4000); });
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if (fault) { assert(killed, errorText); assert.equal(result.signal, 'SIGKILL'); }
    else { assert.equal(result.code, 0, errorText); assert(output.includes(`"status":"${selection ? 'selected' : 'verified'}"`)); }
  } finally { clearTimeout(timer); }
}

// Each run resumes the prior incomplete phase; the source is never repurposed.
for (const phase of ['copy', 'ownership', 'authentication']) await worker(`applied:${phase}`);
await worker('database-started'); // PostgreSQL survives Node; resume must stop the registered candidate.
await worker('applied:roles');
await worker('applied:verification');
await worker();
await worker(); // Completed receipt is revalidated, not blindly trusted.
assert.equal(await digestMigrationTree(SOURCE, await inspectMigrationTree(SOURCE)), originalDigest);
assert.equal((await lstat('/identity-migration/source')).uid, 1000);
assert.equal((await lstat('/identity-migration/pg_hba.conf')).uid, 0);
const receipt = JSON.parse(await readFile('/identity-migration/migration.json', 'utf8'));
assert.equal(receipt.completed, 5);
assert.equal(receipt.pending, null);
for (const point of ['before:verify', 'verified', 'selected', 'runtime-write', 'restart-read']) {
  await worker(point, true);
}
await worker(undefined, true);
await worker(undefined, true);
await verifySelectedStartup({ signalRuntime: true });
await verifySelectedStartup();
// Re-read the earlier committed write after the selected supervisor lifecycle.
await worker('restart-read', true);
await worker(undefined, true);
assert.equal(await digestMigrationTree(SOURCE, await inspectMigrationTree(SOURCE)), originalDigest);
const selection = JSON.parse(await readFile('/identity-migration/selection.json', 'utf8'));
assert.deepEqual(selection, { version: 1, binding: receipt.binding, phase: 'selected' });
process.stdout.write('PASS durable_candidate_selection_retains_committed_writes_after_process_death\n');
process.stdout.write('PASS selected_startup_maintenance_runtime_sigterm_and_exclusive_lease\n');
process.stdout.write('PASS resumable_legacy_identity_copy_and_real_process_crash_recovery\n');
