/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareSelectedDatabase, readSelectedDatabaseFile, SELECTED_DATABASE_DATA } from './embeddedSelectedDatabaseLayout.mjs';
import { verifySelectedDatabaseShutdown } from './embeddedSelectedDatabaseProcess.mjs';
import { inspectMigrationTree } from './embeddedMigrationTree.mjs';
import { createSelectedEmbeddedDatabase } from './embeddedSelectedDatabase.mjs';
import { runEmbeddedDatabaseOperation } from './embeddedDatabaseOperation.mjs';
import { verifySelectedMigrationPolicy, validateSelectedSystemIdentifier } from './selectedMigrationPolicy.mjs';
import { verifySelectedMigrationRoles } from './selectedMigrationRoleVerification.mjs';

/** Caller holds the selection lease and supplies an independently recorded cluster ID.
 * No source copy, role repair, schema update, receipt fabrication or runtime launch.
 */
export async function verifySelectedMigration({ expectedSystemId, signal, timeoutMs = 300_000,
  platform = process.platform, uid = process.getuid?.(), prepare = prepareSelectedDatabase,
  read = readSelectedDatabaseFile, inspect = inspectMigrationTree, control = verifySelectedDatabaseShutdown,
  createDatabase = createSelectedEmbeddedDatabase, verifyRoles = verifySelectedMigrationRoles,
}) {
  validateSelectedSystemIdentifier(expectedSystemId);
  if (platform !== 'linux' || uid !== 0) throw new Error('selected_migration_root_required');
  let identity;
  const preflight = cancellation => runEmbeddedDatabaseOperation(async scoped => {
    identity = await prepare({ signal: scoped });
    const policy = {};
    for (const kind of ['config', 'hba', 'ident']) policy[kind] = await read(kind, 0, { signal: scoped });
    verifySelectedMigrationPolicy(policy);
    const tree = await inspect(SELECTED_DATABASE_DATA, { signal: scoped, identity });
    if (tree.entries.some(entry => ['standby.signal', 'recovery.signal'].includes(entry.relative))) {
      throw new Error('selected_migration_recovery_mode_unsupported');
    }
    await control({ signal: scoped, expectedSystemId });
  }, { signal: cancellation, timeoutMs: 25_000 });
  await preflight(signal);
  const database = createDatabase({ timeoutMs });
  let adopted = false, unjoined = false;
  try {
    await database.adopt({ signal }); adopted = true;
    await verifyRoles({ identity, signal });
    signal?.throwIfAborted();
  } catch (error) {
    unjoined = error?.message === 'selected_migration_helper_unjoined';
    throw error;
  } finally {
    // An unjoined helper requires container termination, not another attempt.
    if (adopted && !unjoined) await database.stop();
  }
  await preflight(signal);
}
