/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';
import { createQueueMaintenanceBroker } from './embeddedQueueMaintenanceBroker.mjs';
import { compatibleMaintenanceEnvironment } from './embeddedCompatibleMaintenanceEnvironment.mjs';

/** Existing same-identity embedded deployment only; this does not create authority. */
export function startCompatibleQueueMaintenance({ spawnFn = spawn,
  uid = process.getuid?.(), gid = process.getgid?.(), platform = process.platform,
} = {}) {
  if (platform !== 'linux') throw new Error('compatible_queue_worker_environment_invalid');
  parseEmbeddedId(uid); parseEmbeddedId(gid);
  const child = spawnFn('/usr/local/bin/node', ['/app/src/scripts/runCompatibleQueueRecovery.mjs', '--assess'], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    // No uid/gid switch, shell, inherited credentials or preload/PG option hooks.
    env: compatibleMaintenanceEnvironment(),
  });
  return observeEmbeddedMaintenance(child);
}

export function createCompatibleQueueMaintenanceBroker({ channel, onFatal, report,
  start = startCompatibleQueueMaintenance, uid = process.getuid?.(), gid = process.getgid?.(),
  platform = process.platform,
}) {
  if (platform !== 'linux') throw new Error('compatible_queue_worker_environment_invalid');
  parseEmbeddedId(uid); parseEmbeddedId(gid);
  return createQueueMaintenanceBroker({ channel, onFatal, report, start: () => start({ uid, gid, platform }) });
}
