/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { posix } from 'node:path';
import { runEmbeddedDatabaseOperation } from '../bootstrap/embeddedDatabaseOperation.mjs';
import { SELECTED_RESTORE_MAX_BYTES } from '../bootstrap/embeddedSelectedMaintenanceContract.mjs';

export const isSelectedBackupName = name => typeof name === 'string' && name.length <= 200
  && /^classifarr_config_[A-Za-z0-9_.-]+\.json$/.test(name) && !name.includes('..');
const invalid = () => new Error('restore_backup_unavailable');

/** App identity only. No mkdir, repair, symlink following or privileged path handoff. */
export function createSelectedRestoreBackupFiles({ directory, uid = process.getuid?.(), io = fs }) {
  let poisoned = false;
  const safe = stat => [0, uid].includes(stat.uid) && !(stat.mode & 0o7022);
  const regular = stat => stat.isFile() && safe(stat) && stat.nlink === 1
    && stat.size > 0 && stat.size <= SELECTED_RESTORE_MAX_BYTES - 32_768;
  async function inspectDirectory(signal) {
    if (!posix.isAbsolute(directory) || posix.normalize(directory) !== directory) throw invalid();
    const parts = directory.split('/').filter(Boolean);
    for (let index = 1; index <= parts.length; index++) {
      signal.throwIfAborted();
      const stat = await io.lstat('/' + parts.slice(0, index).join('/'));
      if (!stat.isDirectory() || !safe(stat)) throw invalid();
    }
  }
  async function bounded(work) {
    if (poisoned) throw invalid();
    try { return await runEmbeddedDatabaseOperation(async signal => {
      await inspectDirectory(signal);
      return work(signal);
    }, { timeoutMs: 10_000 }); } catch (error) {
      if (error.code === 'database_operation_unjoined') poisoned = true;
      throw invalid();
    }
  }
  return {
    async read(filename) {
      if (!isSelectedBackupName(filename)) throw invalid();
      return bounded(async signal => {
        let file, buffer;
        try {
          file = await io.open(posix.join(directory, filename), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
          const before = await file.stat();
          if (!regular(before)) throw invalid();
          buffer = Buffer.alloc(before.size + 1);
          let size = 0;
          while (size < buffer.length) {
            signal.throwIfAborted();
            const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
            if (!bytesRead) break;
            size += bytesRead;
          }
          const after = await file.stat();
          signal.throwIfAborted();
          if (size !== before.size || ['dev', 'ino', 'size', 'mtimeMs', 'ctimeMs', 'mode', 'uid', 'gid', 'nlink']
            .some(key => before[key] !== after[key])) throw invalid();
          return JSON.parse(buffer.subarray(0, size).toString('utf8'));
        } finally { buffer?.fill(0); await file?.close(); }
      });
    },
    async list() {
      return bounded(async signal => {
        const results = []; let count = 0;
        const handle = await io.opendir(directory);
        for await (const entry of handle) {
          signal.throwIfAborted();
          if (++count > 512) throw invalid();
          if (!entry.isFile() || !isSelectedBackupName(entry.name)) continue;
          const stat = await io.lstat(posix.join(directory, entry.name));
          if (!regular(stat)) continue;
          results.push({ filename: entry.name, type: entry.name.endsWith('.enc.json') ? 'encrypted' : 'plaintext',
            size: stat.size, createdAt: stat.birthtime, modifiedAt: stat.mtime });
        }
        return results.sort((a, b) => b.modifiedAt - a.modifiedAt);
      });
    },
  };
}
