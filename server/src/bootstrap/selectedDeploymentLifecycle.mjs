/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { readEmbeddedAccounts, requireSeparatedEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';
import { selectedDeploymentConfiguration } from './selectedDeploymentConfiguration.mjs';
import { createSelectedEmbeddedDatabase } from './embeddedSelectedDatabase.mjs';
import { runSelectedEmbeddedStartup } from './embeddedSelectedStartup.mjs';
import { startSelectedApplication } from './embeddedSelectedApplication.mjs';
import { startSelectedRestoreHttp } from './embeddedSelectedRestoreHttp.mjs';
import { startSelectedMaintenance } from './embeddedSelectedMaintenance.mjs';

/** Trusted caller retains selection lease; verifiers are code, never saved settings.
 * No migration, legacy fallback or process-global identity/mask mutation here.
 */
export async function runSelectedDeploymentLifecycle({ environment, journal, binding, verify, verifyVectorStaging,
  processRef = process, report = () => {},
  context = { platform: process.platform, uid: process.getuid?.(), umask: process.umask() },
  accounts = async () => readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')),
  createDatabase = createSelectedEmbeddedDatabase, run = runSelectedEmbeddedStartup,
  startNormal = startSelectedApplication, startRestore = startSelectedRestoreHttp,
  startMaintenance = startSelectedMaintenance,
}) {
  if (context.platform !== 'linux' || context.uid !== 0 || typeof verify !== 'function'
    || typeof verifyVectorStaging !== 'function') throw new Error('selected_deployment_lifecycle_invalid');
  const { mode, configuration, supervisor } = selectedDeploymentConfiguration(environment, { allowRestoreHttp: true });
  const identities = requireSeparatedEmbeddedAccounts(await accounts());
  if (identities.application.uid !== supervisor.uid || identities.application.gid !== supervisor.gid
    || context.umask !== Number.parseInt(supervisor.umask, 8)) throw new Error('selected_deployment_identity_or_mask_mismatch');
  const restoreHttp = mode === 'restore';
  return run({ journal, binding, processRef, report, restoreHttp,
    database: createDatabase({ timeoutMs: supervisor.databaseStartupTimeoutMs, report }),
    verify: async ({ signal }) => {
      await verify({ signal, identities });
      signal.throwIfAborted();
      await verifyVectorStaging({ signal, mode: supervisor.vectorStaging });
      signal.throwIfAborted();
    },
    startMaintenance: restoreHttp ? null : () => startMaintenance({ operation: 'schema', identity: identities.database, report }),
    startApplication: ({ onFatal }) => restoreHttp
      ? startRestore({ identities, configuration, onFatal })
      : startNormal({ identity: identities.application, configuration }),
  });
}
