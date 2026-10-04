/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { startEmbeddedApplication } from '../bootstrap/embeddedChildProcess.mjs';
import { createEmbeddedDatabaseControl } from '../bootstrap/embeddedDatabaseControl.mjs';
import { runEmbeddedSupervisor } from '../bootstrap/embeddedSupervisor.mjs';
import { createCompatibleQueueMaintenanceBroker } from '../bootstrap/embeddedCompatibleQueueMaintenance.mjs';
import { createCompatibleImageIndexBroker } from '../bootstrap/embeddedCompatibleImageIndex.mjs';
import { startCompatibleProfilingMaintenance } from '../bootstrap/embeddedCompatibleProfilingMaintenance.mjs';
import { readOperatingMode } from '../config/operatingMode.mjs';

export function assertEmbeddedSupervisorEnvironment(environment, { uid, platform, cwd, args }) {
  if (platform !== 'linux' || !Number.isInteger(uid) || uid <= 0 || cwd !== '/app'
    || args.length !== 1 || args[0] !== '--run'
    || environment.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL !== undefined
    || environment.CLASSIFARR_IMAGE_INDEX_CHANNEL !== undefined
    || (environment.CLASSIFARR_SCHEMA_MAINTENANCE ?? 'startup') !== 'startup'
    || environment.POSTGRES_HOST !== 'localhost' || environment.POSTGRES_PORT !== '5432'
    || environment.POSTGRES_DB !== 'classifarr' || environment.POSTGRES_USER !== 'classifarr') {
    throw new Error('embedded_supervisor_environment_invalid');
  }
}

export function embeddedRuntimeComposition({ environment = process.env, start = startEmbeddedApplication,
  attach = createCompatibleQueueMaintenanceBroker, attachIndexes = createCompatibleImageIndexBroker, report = () => {},
  startProfiling = startCompatibleProfilingMaintenance,
} = {}) {
  const normal = readOperatingMode(environment) === 'normal';
  return {
    ...(normal ? { startMaintenance: () => startProfiling({ report }) } : {}),
    startApplication: () => start({ environment, queueMaintenance: normal, imageIndexMaintenance: normal }),
    ...(normal ? { attachRuntimeMaintenance: (application, onFatal) => {
      const brokers = [];
      try {
        brokers.push(attach({ channel: application.maintenanceChannel, onFatal,
          report: status => report(status, 'shared_identity', 'queue_recovery') }));
        brokers.push(attachIndexes({ channel: application.imageIndexChannel, onFatal,
          report: status => report(status, 'shared_identity', 'image_indexes') }));
        report('available', 'shared_identity', 'queue_recovery');
        report('available', 'shared_identity', 'image_indexes');
      } catch { onFatal(); }
      return { async stop() {
        const results = await Promise.allSettled(brokers.map(broker => Promise.resolve().then(() => broker.stop())));
        if (results.some(result => result.status === 'rejected')) throw new Error('maintenance_exit_unconfirmed');
      } };
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
      ...embeddedRuntimeComposition({ report: (status, authority, operation) =>
        process.stdout.write(`${JSON.stringify({ component: 'EmbeddedQueueMaintenance', status, authority, operation })}\n`) }),
      report: (status, reason) => process.stdout.write(`${JSON.stringify({ component: 'EmbeddedSupervisor', status, ...(reason ? { reason } : {}) })}\n`),
    });
  } catch {
    process.stderr.write('Embedded supervisor refused startup; verify the packaged embedded entrypoint and configuration.\n');
  }
  // eslint-disable-next-line n/no-process-exit -- final container lifecycle decision, including an unjoinable child failure
  process.exit(code);
}
