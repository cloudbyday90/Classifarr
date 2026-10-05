/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import fs, { constants } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { diagnosticSchema, MAX_DIAGNOSTIC_BYTES } from './migrationDiagnosticContract.mjs';

/** Fixed destination; no request may choose a path. The report grants no authority. */
export function createMigrationDiagnosticStore({ environment = process.env, fileSystem = fs } = {}) {
  const root = path.resolve(environment.LOG_DIR || '/app/data/logs', 'schema-migrations');
  const destination = path.join(root, 'last-failure.json');
  const flags = (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0);
  function assertPrivate(stat, directory = false) {
    if (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) throw new Error('diagnostic_storage_unsafe');
    if (process.platform !== 'win32' && (stat.uid !== process.geteuid() || (stat.mode & 0o077))) throw new Error('diagnostic_storage_private_owner_required');
  }
  async function checkRoot(create = false) {
    if (create) await fileSystem.mkdir(root, { mode: 0o700 });
    assertPrivate(await fileSystem.lstat(root), true);
    if (await fileSystem.realpath(root) !== root) throw new Error('diagnostic_storage_symlink');
  }
  return {
    async write(report) {
      const data = JSON.stringify(diagnosticSchema.parse(report), null, 2) + '\n';
      if (Buffer.byteLength(data) > MAX_DIAGNOSTIC_BYTES) throw new Error('diagnostic_storage_limit');
      try { await checkRoot(true); } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        await checkRoot();
      }
      if ((await fileSystem.readdir(root)).length >= 8) throw new Error('diagnostic_storage_entries_limit');
      const temporary = path.join(root, `.pending-${randomUUID()}.json`);
      let handle;
      try {
        handle = await fileSystem.open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | flags, 0o600);
        assertPrivate(await handle.stat());
        await handle.writeFile(data, 'utf8');
        await handle.sync();
        await handle.close();
        handle = undefined;
        await fileSystem.rename(temporary, destination);
        if (process.platform === 'linux') {
          const directory = await fileSystem.open(root, constants.O_RDONLY | flags);
          try { await directory.sync(); } finally { await directory.close(); }
        }
      } finally {
        await handle?.close().catch(() => {}); // swallow-error: cleanup must not replace the original persistence failure.
        await fileSystem.unlink(temporary).catch(() => {}); // swallow-error: only our temp file; a failed cleanup is bounded by the entry limit.
      }
    },
    async read() {
      let handle;
      try {
        await checkRoot();
        // O_NOFOLLOW is unavailable on Windows. Reject links/reparse targets before
        // opening, then compare the opened identity; the private directory is required.
        const before = await fileSystem.lstat(destination);
        assertPrivate(before);
        handle = await fileSystem.open(destination, constants.O_RDONLY | flags);
        const stat = await handle.stat();
        assertPrivate(stat);
        if (stat.dev !== before.dev || stat.ino !== before.ino) throw new Error('diagnostic_storage_changed');
        if (stat.size > MAX_DIAGNOSTIC_BYTES) throw new Error('diagnostic_storage_limit');
        const bytes = Buffer.alloc(MAX_DIAGNOSTIC_BYTES + 1);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
        if (bytesRead > MAX_DIAGNOSTIC_BYTES) throw new Error('diagnostic_storage_limit');
        return { status: 'available', report: diagnosticSchema.parse(JSON.parse(bytes.subarray(0, bytesRead).toString('utf8'))) };
      } catch (error) {
        return { status: error.code === 'ENOENT' ? 'none' : 'unavailable' };
      } finally { await handle?.close().catch(() => {}); } // swallow-error: read status is already determined; never expose filesystem error text.
    },
  };
}
