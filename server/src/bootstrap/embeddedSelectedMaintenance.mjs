/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';
import { selectedMaintenanceEnvironment, selectedMaintenanceTimeout, SELECTED_RESTORE_MAX_BYTES } from './embeddedSelectedMaintenanceContract.mjs';
import { RESTORE_VERIFICATION_REQUIRED_EXIT, RESTORE_VERIFICATION_REQUIRED_MESSAGE } from '../utils/schemaMaintenanceFailure.mjs';

/** Trusted root caller holds the selected-database lease; never an online runtime broker. */
export function startSelectedMaintenance({ operation, identity, request = null, report = () => {},
  spawnFn = spawn, uid = process.getuid?.(), platform = process.platform,
} = {}) {
  const timeout = selectedMaintenanceTimeout(operation);
  if (platform !== 'linux' || uid !== 0) throw new Error('selected_maintenance_root_required');
  const target = `${parseEmbeddedId(identity?.uid)}:${parseEmbeddedId(identity?.gid)}`;
  if (operation === 'schema' ? request !== null
    : !Buffer.isBuffer(request) || request.length === 0 || request.length > SELECTED_RESTORE_MAX_BYTES) {
    throw new Error('selected_maintenance_request_invalid');
  }
  const child = spawnFn('/sbin/su-exec', [target, '/usr/local/bin/node',
    '/app/src/scripts/runSelectedMaintenance.mjs', `--${operation}`], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'], timeout, killSignal: 'SIGKILL',
    env: selectedMaintenanceEnvironment(),
  });
  const observed = observeEmbeddedMaintenance(child, request);
  return { ...observed, done: observed.done.then(result => {
    if (operation === 'schema' && result.code === RESTORE_VERIFICATION_REQUIRED_EXIT && result.signal === null) {
      try { report('maintenance_failed', 'restore_verification_required', undefined, RESTORE_VERIFICATION_REQUIRED_MESSAGE); }
      catch { /* diagnostics cannot change admission or cleanup */ }
    }
    return result;
  }) };
}
