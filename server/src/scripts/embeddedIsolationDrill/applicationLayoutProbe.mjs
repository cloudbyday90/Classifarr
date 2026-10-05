/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile, rename, symlink, unlink, mkdir, rmdir, lstat } from 'node:fs/promises';
import { provisionEmbeddedApplicationLayout } from '../../bootstrap/embeddedApplicationLayout.mjs';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { observeEmbeddedChild, waitForEmbeddedExit } from '../../bootstrap/embeddedChildProcess.mjs';
import { MIGRATION_ROOT, migrationCommand, migrationEnvironment } from './identityMigrationDatabase.mjs';

/** Called only after the fixture drains the old app and protects its scratch parent. */
export async function verifyApplicationLayout() {
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, () => provisionEmbeddedApplicationLayout());
  await migrationCommand('classifarr', 'node', ['--input-type=module', '-e', `
    import { writeFile } from 'node:fs/promises';
    await writeFile('/app/data/config/layout-fixture.json', '{"preserved":true}', {flag:'wx',mode:0o600});
    await writeFile('/app/data/secrets/layout-fixture-key', 'synthetic-not-a-real-key', {flag:'wx',mode:0o600});
  `]);
  const targetBefore = await lstat('/app/data/embedded-postgres');
  // Preserve even the synthetic existing backup directory during adversarial tests.
  await rename('/app/data/backups', '/app/data/backups.fixture-saved');
  await symlink('/app/data/embedded-postgres', '/app/data/backups');
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {
    await assert.rejects(provisionEmbeddedApplicationLayout(), error => ['ELOOP', 'ENOTDIR'].includes(error.code));
  });
  const targetAfter = await lstat('/app/data/embedded-postgres');
  assert.equal(targetAfter.uid, targetBefore.uid); assert.equal(targetAfter.mode, targetBefore.mode);
  await unlink('/app/data/backups');
  await mkdir('/app/data/backups', { mode: 0o700 });
  await writeFile('/app/data/backups/root-sentinel', 'do-not-adopt', { flag: 'wx' });
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {
    await assert.rejects(provisionEmbeddedApplicationLayout(), /embedded_application_directory_invalid/);
  });
  assert.equal(await readFile('/app/data/backups/root-sentinel', 'utf8'), 'do-not-adopt');
  await unlink('/app/data/backups/root-sentinel');
  const processChild = spawn(process.execPath, ['src/scripts/embeddedIsolationDrill/applicationLayoutWorker.mjs', '--interrupt'], {
    cwd: '/app', env: migrationEnvironment(), stdio: ['ignore', 'pipe', 'ignore'], shell: false,
  });
  const child = observeEmbeddedChild(processChild);
  let output = '', interrupted = false;
  processChild.stdout.on('data', chunk => {
    output += chunk.toString();
    if (output.length > 1024) child.signal('SIGKILL');
    if (!interrupted && output.includes('application-layout-interrupt-ready\n')) {
      interrupted = true; child.signal('SIGKILL');
    }
  });
  try {
    const result = await waitForEmbeddedExit(child.done, 15_000);
    assert(interrupted); assert.equal(result.signal, 'SIGKILL');
  } finally {
    if (!child.hasExited()) { child.signal('SIGKILL'); await waitForEmbeddedExit(child.done, 2000); }
  }
  assert.equal((await lstat('/app/data/backups')).uid, 0);
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, () => provisionEmbeddedApplicationLayout());
  assert.equal((await lstat('/app/data/backups')).uid, 1000);
  await rmdir('/app/data/backups'); // Exact empty scratch directory, never recursive.
  await rename('/app/data/backups.fixture-saved', '/app/data/backups');
  await withEmbeddedMigrationJournal(MIGRATION_ROOT, () => provisionEmbeddedApplicationLayout());
  await migrationCommand('classifarr', 'node', ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFile, writeFile, unlink } from 'node:fs/promises';
    assert.equal(await readFile('/app/data/config/layout-fixture.json','utf8'), '{"preserved":true}');
    assert.equal(await readFile('/app/data/secrets/layout-fixture-key','utf8'), 'synthetic-not-a-real-key');
    for (const name of ['config','secrets','logs','backups']) {
      const path = '/app/data/' + name + '/layout-write-probe';
      await writeFile(path,'ok',{flag:'wx'}); await unlink(path);
    }
    await assert.rejects(writeFile('/app/data/forbidden-layout-write','no',{flag:'wx'}), error => error.code === 'EACCES');
    await assert.rejects(writeFile('/app/data/embedded-postgres/forbidden-layout-write','no',{flag:'wx'}), error => error.code === 'EACCES');
  `]);
  process.stdout.write('PASS protected_application_directories_preserved_and_restart_safe\n');
}
