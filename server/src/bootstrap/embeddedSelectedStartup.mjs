/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { selectEmbeddedMigration } from './embeddedMigrationSelection.mjs';
import { runEmbeddedSupervisor } from './embeddedSupervisor.mjs';

/** Trusted composition inside a held journal lease; never a saved-template mode.
 * The adapter owns bounded start/adopt and cleanup of a partial start. The caller
 * must terminate the container on failure rather than release it for new work.
 */
export async function runSelectedEmbeddedStartup({ journal, binding, verify, database,
  startMaintenance, startApplication, attachRuntimeMaintenance = null,
  processRef = process, report = () => {},
}) {
  if (typeof verify !== 'function' || typeof startMaintenance !== 'function'
    || typeof startApplication !== 'function'
    || !['adopt', 'check', 'stop'].every(key => typeof database?.[key] === 'function')) {
    throw new Error('selected_startup_composition_invalid');
  }
  return runEmbeddedSupervisor({
    database: {
      async adopt({ signal }) {
        signal.throwIfAborted();
        await selectEmbeddedMigration({ journal, binding, verify: async () => {
          signal.throwIfAborted();
          await verify({ signal });
          signal.throwIfAborted();
        } });
        signal.throwIfAborted();
        await database.adopt({ signal });
      },
      check: options => database.check(options),
      stop: () => database.stop(),
    },
    startMaintenance, startApplication, attachRuntimeMaintenance,
    processRef, report,
  });
}
