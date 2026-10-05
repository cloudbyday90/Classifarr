/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { observeEmbeddedChild, waitForEmbeddedExit } from './embeddedChildProcess.mjs';
import { validateSelectedSystemIdentifier } from './selectedMigrationPolicy.mjs';

/** Caller validated a trusted, offline source path under its protected parent. */
export async function readOfflineMigrationControl(source, { signal, spawnFn = spawn } = {}) {
  signal?.throwIfAborted();
  const child = spawnFn('/usr/libexec/postgresql18/pg_controldata', [source], {
    cwd: '/app', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, shell: false, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const observed = observeEmbeddedChild(child);
  const closed = new Promise(resolve => { child.once('close', resolve); });
  let output = '', failed = false;
  const stop = () => { failed = true; observed.signal('SIGKILL'); };
  child.stdout.on('data', chunk => {
    if (failed) return;
    if (Buffer.byteLength(output) + chunk.length > 16384) { output = ''; stop(); }
    else output += chunk.toString();
  });
  child.stdout.on('error', stop);
  signal?.addEventListener('abort', stop, { once: true });
  if (signal?.aborted) stop();
  const timer = setTimeout(stop, 2000);
  try {
    let result;
    try { [result] = await waitForEmbeddedExit(Promise.all([observed.done, closed]), 4000); }
    catch { throw new Error('migration_source_control_unjoined'); }
    if (failed || result.code !== 0 || result.signal !== null
      || !/Database cluster state:\s+shut down\s*\n/.test(output)) throw new Error('migration_source_not_stopped');
    return validateSelectedSystemIdentifier(output.match(/^Database system identifier:\s+(\d+)\s*$/m)?.[1]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
}
