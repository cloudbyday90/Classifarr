/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runSelectedEmbeddedStartup } from '../../bootstrap/embeddedSelectedStartup.mjs';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { validateMigrationReceipt } from '../../bootstrap/embeddedMigrationPhases.mjs';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { MIGRATION_ROOT, databaseIdentity } from './identityMigrationDatabase.mjs';
import { prepareIdentityMigration } from './identityMigrationSteps.mjs';
import { startSelectedFixtureChild } from './identityStartupAdapter.mjs';
import { createSelectedEmbeddedDatabase } from '../../bootstrap/embeddedSelectedDatabase.mjs';
import { launchSelectedDatabase, verifySelectedDatabaseShutdown } from '../../bootstrap/embeddedSelectedDatabaseProcess.mjs';
import { provisionEmbeddedApplicationLayout } from '../../bootstrap/embeddedApplicationLayout.mjs';
import { startSelectedMaintenance } from '../../bootstrap/embeddedSelectedMaintenance.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
assert(process.argv.length === 2 || (process.argv.length === 3 && ['--signal', '--cancel-start'].includes(process.argv[2])));
const wait = process.argv[2] === '--signal';
const cancelStartup = process.argv[2] === '--cancel-start';
await withEmbeddedMigrationJournal(MIGRATION_ROOT, async journal => {
  const { binding, steps } = await prepareIdentityMigration();
  const identity = await databaseIdentity();
  let launched;
  const database = createSelectedEmbeddedDatabase({ launch: account => {
    launched = launchSelectedDatabase(account);
    // Real process, real host signal after launch, before admission completes.
    if (cancelStartup) queueMicrotask(() => process.kill(process.pid, 'SIGTERM'));
    return launched;
  } });
  const code = await runSelectedEmbeddedStartup({ journal, binding,
    verify: async ({ signal }) => {
      await steps.prepare(validateMigrationReceipt(await journal.read(), binding));
      signal.throwIfAborted();
      await steps.verification();
      await provisionEmbeddedApplicationLayout({ signal });
    },
    database,
    startMaintenance: () => { assert(!cancelStartup); return startSelectedMaintenance({ operation: 'schema', identity }); },
    startApplication: () => { assert(!cancelStartup); return startSelectedFixtureChild('runtime', { wait,
      onReady: () => process.stdout.write('selected-startup-ready\n') }); },
  });
  assert.equal(code, cancelStartup ? 1 : 0, 'selected_startup_failed');
  if (cancelStartup) {
    assert(launched?.hasExited(), 'cancelled_database_child_not_joined');
    await verifySelectedDatabaseShutdown({ signal: AbortSignal.timeout(5000) });
    await assert.rejects(readFile('/app/data/embedded-postgres/candidate/postmaster.pid'), error => error.code === 'ENOENT');
  }
  // Even after the supervisor stopped PG, this caller still owns the lease.
  await assert.rejects(withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {}), /migration_lock_unavailable/);
});
process.stdout.write('selected-startup-passed\n');
