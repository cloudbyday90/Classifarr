/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, lstat, readdir, open, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { constants } from 'node:fs';
// The storage root is trusted composition, never HTTP input; private directories and random
// exclusive filenames below it are checked before writes. No caller-supplied filename exists.
/* eslint-disable security/detect-non-literal-fs-filename */

/** Bounded, shell-free subprocess; no stderr or connection details escape. */
export async function runRepairBackupChild(command, args, { environment, onChunk = async () => {},
  signal, spawnFn = spawn, timeoutMs = 60_000, maxBytes = 256 * 1024 * 1024 } = {}) {
  let child, bytes = 0, failed = false, storageCode;
  const stop = () => { failed = true; child?.kill('SIGKILL'); };
  if (signal?.aborted) throw new Error('backup_cancelled');
  child = spawnFn(command, args, { shell: false, env: environment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  // Warnings can mean an incomplete export; refuse without retaining sensitive output.
  child.stderr.on('data', stop);
  const closed = new Promise(resolveClose => {
    child.once('error', () => { failed = true; });
    child.once('close', (code, exitSignal) => resolveClose(code === 0 && exitSignal === null));
  });
  const timer = setTimeout(stop, timeoutMs);
  signal?.addEventListener('abort', stop, { once: true });
  try {
    for await (const chunk of child.stdout) {
      bytes += chunk.length;
      if (bytes > maxBytes || failed) { stop(); break; }
      await onChunk(chunk);
    }
  } catch (error) {
    if (['ENOSPC', 'EACCES', 'EPERM'].includes(error?.code)) storageCode = error.code;
    stop();
  }
  finally {
    const succeeded = await closed; // Join before releasing locks or admitting another repair.
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    if (!succeeded || failed || !bytes) throw Object.assign(new Error('backup_process_failed'), { code: storageCode });
  }
  return bytes;
}

export function createIngestionRepairBackup({ root = '/app/data/ingestion-repair-backups',
  platform = process.platform, run = runRepairBackupChild } = {}) {
  async function available() {
    if (platform !== 'linux') return false;
    try { await access('/usr/bin/pg_dump', constants.X_OK); await access('/usr/bin/pg_restore', constants.X_OK); return true; }
    catch { return false; }
  }
  return { available, async create(options, signal) {
    if (!await available()) throw new Error('backup_tools_unavailable');
    // No inherited PG service files, shell, hooks, TLS overrides or credentials in argv.
    if (options.ssl || !['host', 'user', 'database', 'password'].every(key => typeof options[key] === 'string')) {
      throw new Error('backup_connection_unsupported');
    }
    await mkdir(root, { mode: 0o700, recursive: true });
    const info = await lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) || info.uid !== process.getuid?.()
      || await realpath(root) !== resolve(root)) throw new Error('backup_storage_unsafe');
    if ((await readdir(root)).length >= 3) throw new Error('backup_storage_full');
    const id = randomUUID(), directory = join(root, id);
    await mkdir(directory, { mode: 0o700 });
    const file = await open(join(directory, 'database.dump'), 'wx', 0o600);
    const digest = createHash('sha256');
    const environment = { PATH: '/usr/bin:/bin', LANG: 'C', PGCONNECT_TIMEOUT: '5',
      PGHOST: options.host, PGPORT: String(options.port || 5432), PGDATABASE: options.database,
      PGUSER: options.user, PGPASSWORD: options.password, PGAPPNAME: 'classifarr-safeguard-backup' };
    let bytes;
    try {
      bytes = await run('/usr/bin/pg_dump', ['--no-password', '--format=custom', '--lock-wait-timeout=5s'], {
        environment, signal, onChunk: async chunk => {
          digest.update(chunk);
          let offset = 0;
          while (offset < chunk.length) {
            const result = await file.write(chunk, offset, chunk.length - offset);
            if (!result.bytesWritten) throw new Error('backup_write_failed');
            offset += result.bytesWritten;
          }
        },
      });
      await file.sync();
    } finally { await file.close(); }
    // Read the entire archive, not just its table of contents. This is not a restore rehearsal.
    await run('/usr/bin/pg_restore', ['--file=-', join(directory, 'database.dump')], {
      environment: { PATH: '/usr/bin:/bin', LANG: 'C' }, signal, maxBytes: 1024 * 1024 * 1024,
    });
    for (const path of [directory, root]) { const handle = await open(path, 'r'); try { await handle.sync(); } finally { await handle.close(); } }
    return { id, bytes, sha256: digest.digest('hex'), verification: 'archive_readable' };
  } };
}
