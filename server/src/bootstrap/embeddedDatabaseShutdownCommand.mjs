/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';

/**
 * Only two fixed helpers. Their exit does not alone prove PostgreSQL stopped.
 * @param {string} kind @param {{signal?: AbortSignal, spawnFn?: typeof spawn}} [options]
 */
export async function runEmbeddedDatabaseShutdownCommand(kind, { signal, spawnFn = spawn } = {}) {
  if (!['stop', 'control'].includes(kind)) throw new Error('database_command_invalid');
  signal?.throwIfAborted();
  const child = spawnFn(`/usr/libexec/postgresql18/${kind === 'stop' ? 'pg_ctl' : 'pg_controldata'}`,
    kind === 'stop' ? ['-D', '/app/data/postgres', '-m', 'fast', '-w', '-t', '20', 'stop'] : ['/app/data/postgres'],
    { cwd: '/app', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, shell: false,
      stdio: ['ignore', kind === 'control' ? 'pipe' : 'ignore', 'ignore'] });
  const observed = observeEmbeddedChild(child);
  let output = [], bytes = 0, timedOut = false, overflow = false, ioFailed = false;
  const kill = () => observed.signal('SIGKILL'); // Owned helper only, never the postmaster.
  const closed = new Promise(resolve => { child.once('close', resolve); });
  child.stdout?.on('data', chunk => {
    bytes += chunk.length;
    if (bytes > 65536) { overflow = true; output = []; kill(); }
    else if (!overflow) output.push(chunk);
  });
  child.stdout?.on('error', () => { ioFailed = true; kill(); });
  const timer = setTimeout(() => { timedOut = true; kill(); }, kind === 'stop' ? 22_000 : 2000);
  signal?.addEventListener('abort', kill, { once: true });
  if (signal?.aborted) kill();
  try {
    const [result] = await Promise.all([observed.done, closed]);
    signal?.throwIfAborted();
    if (timedOut || overflow || ioFailed || result.code !== 0 || result.signal !== null) {
      throw new Error('database_command_unconfirmed');
    }
    return { stdout: Buffer.concat(output).toString('utf8') };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', kill);
  }
}
