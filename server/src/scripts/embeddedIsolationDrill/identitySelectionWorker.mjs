/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { validateMigrationReceipt } from '../../bootstrap/embeddedMigrationPhases.mjs';
import { readEmbeddedMigrationSelection, selectEmbeddedMigration } from '../../bootstrap/embeddedMigrationSelection.mjs';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { MIGRATION_ROOT, candidateStart, candidateStop, migrationCommand, migrationSql } from './identityMigrationDatabase.mjs';
import { prepareIdentityMigration } from './identityMigrationSteps.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
assert(process.argv.length === 2 || process.argv.length === 3);
const fault = process.argv[2];
assert(fault === undefined || ['before:verify', 'verified', 'selected', 'runtime-write', 'restart-read'].includes(fault));
const checkpoint = async phase => {
  if (phase !== fault) return;
  process.stdout.write('migration-fault-ready\n');
  await new Promise(() => { setInterval(() => {}, 1000); });
};
await withEmbeddedMigrationJournal(MIGRATION_ROOT, async journal => {
  const { binding, steps } = await prepareIdentityMigration({ journal });
  const result = await selectEmbeddedMigration({ journal, binding, checkpoint, verify: async () => {
    await steps.prepare(validateMigrationReceipt(await journal.read(), binding));
    await steps.verification();
  } });
  assert.equal(await readEmbeddedMigrationSelection({ journal, binding }), 'candidate');
  await candidateStart();
  try {
    if (fault === 'restart-read') {
      // Observe before replaying even the idempotent fixture write.
      assert.equal((await migrationSql("SELECT value FROM migration_sentinel WHERE id=3")).stdout.trim(), 'selected-runtime-write');
      await checkpoint('restart-read');
    }
    await migrationCommand('classifarr', 'node', ['src/scripts/embeddedIsolationDrill/identitySelectionRuntimeProbe.mjs']);
    await checkpoint('runtime-write');
  } finally { await candidateStop(); }
  process.stdout.write(`${JSON.stringify(result)}\n`);
});
