/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { readEmbeddedDatabaseIdentityFile } from './embeddedDatabaseIdentityFile.mjs';

/** @param {string} pid @param {{ signal?: AbortSignal, openFile?: typeof open }} [options] */
export async function readStartupOwnTask(pid, { signal, openFile = open } = {}) {
  if (!/^[1-9]\d{0,9}$/.test(pid) || Number(pid) > 2147483647) throw new Error('database_startup_identity_invalid');
  signal?.throwIfAborted();
  let file;
  const limit = 4096;
  try {
    // Numeric TID only, inside this process's kernel task directory, no symlinks.
    file = await openFile(`/proc/self/task/${pid}/status`,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    signal?.throwIfAborted();
    const stat = await file.stat();
    signal?.throwIfAborted();
    if (!stat.isFile() || stat.size >= limit) throw new Error('database_startup_identity_invalid');
    const buffer = Buffer.alloc(limit);
    let offset = 0;
    while (offset < limit) {
      const { bytesRead } = await file.read(buffer, offset, limit - offset, offset);
      signal?.throwIfAborted();
      if (!bytesRead) return buffer.toString('utf8', 0, offset);
      offset += bytesRead;
    }
    throw new Error('database_startup_identity_invalid');
  } finally { await file?.close(); }
}

export async function readStartupPidFile(signal) {
  try { return await readEmbeddedDatabaseIdentityFile({ signal }); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

/**
 * Exempt only a persistent libuv worker belonging to this dedicated helper.
 * @param {{ readPid?: typeof readStartupPidFile, readTask?: typeof readStartupOwnTask,
 *   environment?: NodeJS.ProcessEnv, processId?: number, signal?: AbortSignal }} [options]
 */
export async function prepareEmbeddedDatabaseStartupEnvironment({
  readPid = readStartupPidFile, readTask = readStartupOwnTask, environment = process.env,
  processId = process.pid, signal,
} = {}) {
  /** @type {NodeJS.ProcessEnv} */
  const launchEnvironment = { ...environment, LC_ALL: 'C' };
  delete launchEnvironment.PG_GRANDPARENT_PID;
  const ordinary = { environment: launchEnvironment, ownThreadCollision: false };
  signal?.throwIfAborted();
  // Initialize libuv's global I/O workers BEFORE the postgres child can reclaim
  // its native lock, not concurrently with its first readiness probe.
  const before = await readPid(signal);
  signal?.throwIfAborted();
  const [pid, path, started] = before.split('\n');
  if (!/^[1-9]\d{0,9}$/.test(pid) || Number(pid) > 2147483647 || Number(pid) === processId
    || path !== '/app/data/postgres' || !/^[1-9]\d*$/.test(started)) return ordinary;
  let task;
  try { task = await readTask(pid, { signal }); }
  catch { signal?.throwIfAborted(); return ordinary; }
  signal?.throwIfAborted();
  const fields = new Map(task.split('\n').map(line => line.split(/:\s*/, 2)));
  if (fields.get('Name') !== 'libuv-worker' || fields.get('Pid') !== pid
    || fields.get('Tgid') !== String(processId)) return ordinary;
  // libuv pool workers live until this helper's process cleanup. Arbitrary
  // Node workers/foreign PIDs are not stable enough for this exception.
  if (await readPid(signal) !== before) throw new Error('database_startup_identity_changed');
  signal?.throwIfAborted();
  launchEnvironment.PG_GRANDPARENT_PID = pid;
  return { environment: launchEnvironment, ownThreadCollision: true };
}
