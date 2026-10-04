/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn, execFile } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { promisify } from 'node:util';
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';
import { parseEmbeddedDatabaseIdentity } from './embeddedDatabaseControl.mjs';
import { readStartupPidFile, prepareEmbeddedDatabaseStartupEnvironment } from './embeddedDatabaseStartupPreflight.mjs';

const execute = promisify(execFile);
const PG_DATA = '/app/data/postgres';

/** Fixed binaries/cluster, direct child ownership, no PID-file removal. */
export function createEmbeddedDatabaseStartupProcess({
  spawnFn = spawn, run = execute, read = readStartupPidFile,
  openLog = () => openSync('/app/data/postgres.log', 'a', 0o600), closeLog = closeSync,
  environment = process.env, prepareEnvironment = prepareEmbeddedDatabaseStartupEnvironment,
} = {}) {
  /** @type {NodeJS.ProcessEnv} */
  let launchEnvironment = { ...environment, LC_ALL: 'C' };
  delete launchEnvironment.PG_GRANDPARENT_PID;
  return {
    async prepare(signal) {
      const prepared = await prepareEnvironment({ readPid: read, environment, signal });
      signal?.throwIfAborted();
      launchEnvironment = prepared.environment;
      return { ownThreadCollision: prepared.ownThreadCollision };
    },
    launch() {
      const fd = openLog();
      try {
        const child = spawnFn('/usr/libexec/postgresql18/postgres', ['-D', PG_DATA], {
          cwd: '/app', env: launchEnvironment, shell: false,
          detached: true, stdio: ['ignore', fd, fd],
        });
        return { ...observeEmbeddedChild(child), pid: child.pid, detach: () => child.unref() };
      } finally { closeLog(fd); }
    },
    async probe(pid, signal) {
      signal?.throwIfAborted();
      const before = await read(signal);
      signal?.throwIfAborted();
      const lines = before.trim().split('\n');
      // A stale/other PID is not adopted. Let our launched postgres either
      // claim its native lock or fail. Never signal a PID read from disk.
      if (!Number.isSafeInteger(pid) || pid <= 0 || lines[0] !== String(pid)) {
        return { ready: false, phase: 'waiting_for_own_process' };
      }
      if (lines.length < 8) return { ready: false, phase: 'starting_or_recovering' };
      const identity = parseEmbeddedDatabaseIdentity(before);
      if (lines[3] !== '5432') throw new Error('database_startup_port_invalid');
      if (lines[7]?.trim() !== 'ready') return { ready: false, phase: 'starting_or_recovering' };
      try {
        await run('/usr/libexec/postgresql18/pg_isready',
          ['-h', '/run/postgresql', '-p', '5432', '-U', 'classifarr', '-d', 'postgres', '-t', '1', '-q'],
          { cwd: '/app', env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, shell: false,
            timeout: 2000, killSignal: 'SIGKILL', maxBuffer: 4096, signal });
      } catch (error) {
        signal?.throwIfAborted();
        if ([1, 2].includes(error.code)) return { ready: false, phase: 'waiting_for_connections' };
        if (error.killed === true && error.signal === 'SIGKILL') {
          return { ready: false, phase: 'waiting_for_connections' };
        }
        throw error;
      }
      const after = await read(signal);
      signal?.throwIfAborted();
      if (parseEmbeddedDatabaseIdentity(after) !== identity) throw new Error('database_startup_identity_changed');
      return { ready: after.trim().split('\n')[7]?.trim() === 'ready', phase: 'waiting_for_connections' };
    },
  };
}
