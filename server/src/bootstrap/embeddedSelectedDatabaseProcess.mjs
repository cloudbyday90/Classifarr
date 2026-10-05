/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { SELECTED_DATABASE_DATA, SELECTED_DATABASE_SOCKET } from './embeddedSelectedDatabaseLayout.mjs';

const environment = () => ({ PATH: '/usr/bin:/bin', LC_ALL: 'C' });

export function launchSelectedDatabase({ uid, gid }, spawnFn = spawn) {
  const child = spawnFn('/sbin/su-exec', [`${parseEmbeddedId(uid)}:${parseEmbeddedId(gid)}`,
    '/usr/libexec/postgresql18/postgres', '-D', SELECTED_DATABASE_DATA,
    '-c', 'config_file=/app/data/embedded-postgres/postgresql.conf',
    '-c', `data_directory=${SELECTED_DATABASE_DATA}`,
    '-c', 'hba_file=/app/data/embedded-postgres/pg_hba.conf',
    '-c', 'ident_file=/app/data/embedded-postgres/pg_ident.conf',
    '-c', 'listen_addresses=', '-c', `unix_socket_directories=${SELECTED_DATABASE_SOCKET}`, '-c', 'port=5432'],
  { cwd: '/app', shell: false, env: environment(), stdio: 'ignore' });
  // Keep the direct child referenced throughout the supervisor's lifecycle.
  return { ...observeEmbeddedChild(child), pid: child.pid, detach: () => {} };
}

/** Read-only fixed helper; parent operation supplies the bounded join deadline. */
export async function verifySelectedDatabaseShutdown({ signal, spawnFn = spawn } = {}) {
  signal?.throwIfAborted();
  const child = spawnFn('/usr/libexec/postgresql18/pg_controldata', [SELECTED_DATABASE_DATA], {
    cwd: '/app', shell: false, env: environment(), stdio: ['ignore', 'pipe', 'ignore'],
  });
  const observed = observeEmbeddedChild(child);
  const closed = new Promise(resolve => { child.once('close', resolve); });
  let output = '', rejected = false;
  const kill = () => observed.signal('SIGKILL'); // This helper only, never PostgreSQL.
  child.stdout.on('data', chunk => {
    if (rejected) return;
    if (Buffer.byteLength(output) + chunk.length > 16384) { rejected = true; output = ''; kill(); }
    else output += chunk.toString();
  });
  child.stdout.on('error', () => { rejected = true; kill(); });
  const timer = setTimeout(() => { rejected = true; kill(); }, 2000);
  signal?.addEventListener('abort', kill, { once: true });
  if (signal?.aborted) kill();
  try {
    const [result] = await Promise.all([observed.done, closed]);
    signal?.throwIfAborted();
    if (rejected || result.code !== 0 || result.signal !== null
      || !/Database cluster state:\s+shut down\s*\n/.test(output)) throw new Error('selected_database_shutdown_unconfirmed');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', kill); }
}
