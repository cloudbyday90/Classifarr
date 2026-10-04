/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';
import { compatibleMaintenanceEnvironment } from './embeddedCompatibleMaintenanceEnvironment.mjs';

/** One pre-runtime assessment using today's identity; not privilege separation. */
export function startCompatibleStartupMaintenance({ spawnFn = spawn, report = () => {},
  uid = process.getuid?.(), gid = process.getgid?.(), platform = process.platform,
} = {}) {
  if (platform !== 'linux') throw new Error('compatible_startup_worker_environment_invalid');
  parseEmbeddedId(uid); parseEmbeddedId(gid);
  const child = spawnFn('/usr/local/bin/node', ['/app/src/scripts/runCompatibleStartupMaintenance.mjs', '--assess'], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 900_000, killSignal: 'SIGKILL',
    env: { ...compatibleMaintenanceEnvironment(),
      POSTGRES_POOL_MAX: '1', POSTGRES_CONN_TIMEOUT_MS: '5000', POSTGRES_STATEMENT_TIMEOUT_MS: '5000' },
  });
  const observed = observeEmbeddedMaintenance(child);
  return { ...observed, done: observed.done.then(result => {
    const status = result.signal === null ? { 0: 'already_active', 10: 'installed', 20: 'deferred' }[result.code] : undefined;
    try {
      report(status ? 'complete' : result.signal === null && result.code === 75 ? 'deferred' : 'failed', 'shared_identity', 'schema');
      if (status) report(status, 'shared_identity', 'query_profiling');
    }
    catch { /* Diagnostics cannot change child completion. */ }
    return status ? { code: 0, signal: null } : result;
  }) };
}
