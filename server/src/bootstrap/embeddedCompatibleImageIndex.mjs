/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';
import { createQueueMaintenanceBroker } from './embeddedQueueMaintenanceBroker.mjs';
import { compatibleMaintenanceEnvironment } from './embeddedCompatibleMaintenanceEnvironment.mjs';
import { encodeImageIndexClaim, decodeImageIndexClaim, IMAGE_INDEX_REQUEST_BYTES,
  IMAGE_INDEX_REQUEST_INTERVAL_MS, IMAGE_INDEX_WORKER_TIMEOUT_MS } from '../utils/imageIndexHandoffProtocol.mjs';

export function startCompatibleImageIndex({ task, spawnFn = spawn,
  uid = process.getuid?.(), gid = process.getgid?.(), platform = process.platform,
}) {
  if (platform !== 'linux') throw new Error('compatible_index_worker_environment_invalid');
  parseEmbeddedId(uid); parseEmbeddedId(gid);
  const request = encodeImageIndexClaim(task);
  const child = spawnFn('/usr/local/bin/node', ['/app/src/scripts/runCompatibleImageIndex.mjs', '--claim'], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: compatibleMaintenanceEnvironment(),
  });
  return observeEmbeddedMaintenance(child, request);
}

export function createCompatibleImageIndexBroker({ channel, onFatal, report,
  start = startCompatibleImageIndex, uid = process.getuid?.(), gid = process.getgid?.(),
  platform = process.platform,
}) {
  if (platform !== 'linux') throw new Error('compatible_index_worker_environment_invalid');
  parseEmbeddedId(uid); parseEmbeddedId(gid);
  return createQueueMaintenanceBroker({ channel, onFatal, report,
    start: task => start({ task, uid, gid, platform }), requestBytes: IMAGE_INDEX_REQUEST_BYTES,
    decodeRequest: decodeImageIndexClaim, intervalMs: IMAGE_INDEX_REQUEST_INTERVAL_MS,
    timeoutMs: IMAGE_INDEX_WORKER_TIMEOUT_MS });
}
