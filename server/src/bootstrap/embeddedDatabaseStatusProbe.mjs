/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';
import { observeProbe } from './embeddedProbeDiagnostics.mjs';

/**
 * Read-only helper: cancellation must observe exit, not just signal delivery.
 * @param {{signal?: AbortSignal, spawnFn?: typeof spawn, observe?: Function}} [options]
 */
export async function runEmbeddedDatabaseStatusProbe({ signal, spawnFn = spawn, observe } = {}) {
  signal?.throwIfAborted();
  observeProbe(observe, 'status_spawn');
  const child = spawnFn('/usr/libexec/postgresql18/pg_ctl', ['-D', '/app/data/postgres', 'status'], {
    cwd: '/app', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, shell: false, stdio: 'ignore',
  });
  const observed = observeEmbeddedChild(child);
  child.once('spawn', () => observeProbe(observe, 'status_wait'));
  let spawnError, timedOut = false;
  child.once('error', error => { spawnError = error; });
  // SIGKILL targets this read-only pg_ctl helper, never the database process.
  const cancel = () => observed.signal('SIGKILL');
  const timer = setTimeout(() => { timedOut = true; observeProbe(observe, 'helper_timeout'); cancel(); }, 2000);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    const result = await observed.done;
    signal?.throwIfAborted();
    if (timedOut) throw Object.assign(new Error('database_probe_timeout'), { code: 'database_probe_timeout' });
    if (spawnError) {
      if (['EAGAIN', 'EMFILE', 'ENFILE'].includes(spawnError.code)) {
        throw Object.assign(new Error('database_probe_resource_pressure'), { code: 'database_probe_resource_pressure' });
      }
      throw spawnError;
    }
    if (result.code !== 0 || result.signal !== null) {
      throw new Error(result.code === 3 ? 'database_not_running' : 'database_status_failed');
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
