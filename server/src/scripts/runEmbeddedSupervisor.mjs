/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { startEmbeddedApplication } from '../bootstrap/embeddedChildProcess.mjs';
import { createEmbeddedDatabaseControl } from '../bootstrap/embeddedDatabaseControl.mjs';
import { runEmbeddedSupervisor } from '../bootstrap/embeddedSupervisor.mjs';
import { createCompatibleQueueMaintenanceBroker } from '../bootstrap/embeddedCompatibleQueueMaintenance.mjs';
import { readOperatingMode } from '../config/operatingMode.mjs';

export function assertEmbeddedSupervisorEnvironment(environment, { uid, platform, cwd, args }) {
  if (platform !== 'linux' || !Number.isInteger(uid) || uid <= 0 || cwd !== '/app'
    || args.length !== 1 || args[0] !== '--run'
    || environment.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL !== undefined
    || (environment.CLASSIFARR_SCHEMA_MAINTENANCE ?? 'startup') !== 'startup'
    || environment.POSTGRES_HOST !== 'localhost' || environment.POSTGRES_PORT !== '5432'
    || environment.POSTGRES_DB !== 'classifarr' || environment.POSTGRES_USER !== 'classifarr') {
    throw new Error('embedded_supervisor_environment_invalid');
  }
}

export function embeddedRuntimeComposition({ environment = process.env, start = startEmbeddedApplication,
  attach = createCompatibleQueueMaintenanceBroker, report = () => {},
} = {}) {
  const normal = readOperatingMode(environment) === 'normal';
  return {
    startApplication: () => start({ environment, queueMaintenance: normal }),
    ...(normal ? { attachRuntimeMaintenance: (application, onFatal) => {
      const broker = attach({ channel: application.maintenanceChannel, onFatal,
        report: status => report(status, 'shared_identity') });
      report('available', 'shared_identity');
      return broker;
    } } : {}),
  };
}

if (import.meta.main) {
  let code = 1;
  try {
    assertEmbeddedSupervisorEnvironment(process.env, {
      uid: process.getuid?.(), platform: process.platform, cwd: process.cwd(), args: process.argv.slice(2),
    });
    code = await runEmbeddedSupervisor({
      database: createEmbeddedDatabaseControl(),
      ...embeddedRuntimeComposition({ report: (status, authority) =>
        process.stdout.write(`${JSON.stringify({ component: 'EmbeddedQueueMaintenance', status, authority })}\n`) }),
      report: (status, reason) => process.stdout.write(`${JSON.stringify({ component: 'EmbeddedSupervisor', status, ...(reason ? { reason } : {}) })}\n`),
    });
  } catch {
    process.stderr.write('Embedded supervisor refused startup; verify the packaged embedded entrypoint and configuration.\n');
  }
  // eslint-disable-next-line n/no-process-exit -- final container lifecycle decision, including an unjoinable child failure
  process.exit(code);
}
