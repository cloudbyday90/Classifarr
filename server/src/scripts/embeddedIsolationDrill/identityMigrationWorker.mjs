/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { withEmbeddedMigrationJournal } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { runEmbeddedMigrationPhases, MIGRATION_PHASES } from '../../bootstrap/embeddedMigrationPhases.mjs';
import { assertDrillEnvironment, assertContainerLayout } from './contract.mjs';
import { MIGRATION_ROOT } from './identityMigrationDatabase.mjs';
import { prepareIdentityMigration } from './identityMigrationSteps.mjs';

assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
assert(process.argv.length === 2 || process.argv.length === 3);
const fault = process.argv[2];
assert(fault === undefined || [...MIGRATION_PHASES.map(phase => `applied:${phase}`), 'database-started', 'source-recorded', 'partial-copy'].includes(fault));
const checkpoint = async phase => {
  if (phase !== fault) return;
  process.stdout.write('migration-fault-ready\n');
  // Only a test checkpoint: the parent kills this process and observes its exit.
  await new Promise(() => { setInterval(() => {}, 1000); });
};
await withEmbeddedMigrationJournal(MIGRATION_ROOT, async journal => {
  const { binding, steps } = await prepareIdentityMigration({ journal, checkpoint, partialCopy: fault === 'partial-copy' });
  const result = await runEmbeddedMigrationPhases({ journal, binding, steps, checkpoint });
  process.stdout.write(`${JSON.stringify(result)}\n`);
});
