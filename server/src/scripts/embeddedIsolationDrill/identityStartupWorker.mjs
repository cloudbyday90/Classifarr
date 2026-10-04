/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runSelectedEmbeddedStartup } from '../../bootstrap/embeddedSelectedStartup.mjs';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { validateMigrationReceipt } from '../../bootstrap/embeddedMigrationPhases.mjs';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { MIGRATION_ROOT } from './identityMigrationDatabase.mjs';
import { prepareIdentityMigration } from './identityMigrationSteps.mjs';
import { selectedCandidateDatabase, startSelectedFixtureChild } from './identityStartupAdapter.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--signal'));
const wait = process.argv[2] === '--signal';
await withEmbeddedMigrationJournal(MIGRATION_ROOT, async journal => {
  const { binding, steps } = await prepareIdentityMigration();
  const code = await runSelectedEmbeddedStartup({ journal, binding,
    verify: async ({ signal }) => {
      await steps.prepare(validateMigrationReceipt(await journal.read(), binding));
      signal.throwIfAborted();
      await steps.verification();
    },
    database: selectedCandidateDatabase(),
    startMaintenance: () => startSelectedFixtureChild('schema'),
    startApplication: () => startSelectedFixtureChild('runtime', { wait,
      onReady: () => process.stdout.write('selected-startup-ready\n') }),
  });
  assert.equal(code, 0, 'selected_startup_failed');
  // Even after the supervisor stopped PG, this caller still owns the lease.
  await assert.rejects(withEmbeddedMigrationJournal(MIGRATION_ROOT, async () => {}), /migration_lock_unavailable/);
});
process.stdout.write('selected-startup-passed\n');
