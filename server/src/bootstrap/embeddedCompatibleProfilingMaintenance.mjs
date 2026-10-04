/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';
import { compatibleMaintenanceEnvironment } from './embeddedCompatibleMaintenanceEnvironment.mjs';

/** One pre-runtime assessment using today's identity; not privilege separation. */
export function startCompatibleProfilingMaintenance({ spawnFn = spawn, report = () => {},
  uid = process.getuid?.(), gid = process.getgid?.(), platform = process.platform,
} = {}) {
  if (platform !== 'linux') throw new Error('compatible_profiling_worker_environment_invalid');
  parseEmbeddedId(uid); parseEmbeddedId(gid);
  const child = spawnFn('/usr/local/bin/node', ['/app/src/scripts/runCompatibleProfilingMaintenance.mjs', '--assess'], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 20_000, killSignal: 'SIGKILL',
    env: { ...compatibleMaintenanceEnvironment(), NODE_OPTIONS: '--max-old-space-size=128',
      POSTGRES_POOL_MAX: '1', POSTGRES_CONN_TIMEOUT_MS: '5000', POSTGRES_STATEMENT_TIMEOUT_MS: '5000' },
  });
  const observed = observeEmbeddedMaintenance(child);
  return { ...observed, done: observed.done.then(result => {
    const status = result.signal === null ? { 0: 'already_active', 10: 'installed', 75: 'deferred' }[result.code] : undefined;
    try { report(status ?? 'failed', 'shared_identity', 'query_profiling'); }
    catch { /* Diagnostics cannot change child completion. */ }
    return status ? { code: 0, signal: null } : result;
  }) };
}
