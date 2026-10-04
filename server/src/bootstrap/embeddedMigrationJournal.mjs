/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { lstat, open, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Trusted composition only, never a request path. Check every ancestor against replacement.
export async function assertProtectedMigrationDirectory(directory) {
  if (process.platform !== 'linux' || process.getuid?.() !== 0 || resolve(directory) !== directory || directory === '/') {
    throw new Error('migration_protected_directory_required');
  }
  for (let path = directory; ; path = dirname(path)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- canonical trusted directory and its ancestors, never followed through symlinks
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o022)) {
      throw new Error('migration_protected_directory_required');
    }
    if (path === '/') break;
  }
}

async function checkedFile(path, flags) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed basenames under the protected directory
  const file = await open(path, flags | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== 0 || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > 8192) {
      throw new Error('migration_journal_file_invalid');
    }
    return file;
  } catch (error) {
    await file.close();
    throw error;
  }
}

// Private factory: only the two fixed basenames below are admitted by composition.
function receiptStore(directory, basename) {
  const destination = join(directory, `${basename}.json`);
  return {
    read: async () => {
      let file;
      try { file = await checkedFile(destination, constants.O_RDONLY); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      try { return JSON.parse(await file.readFile('utf8')); }
      finally { await file.close(); }
    },
    write: async receipt => {
      const data = JSON.stringify(receipt);
      if (Buffer.byteLength(data) > 8192) throw new Error('migration_receipt_too_large');
      const next = join(directory, `${basename}.next`);
      const file = await checkedFile(next, constants.O_RDWR | constants.O_CREAT);
      try { await file.truncate(0); await file.writeFile(data); await file.sync(); }
      finally { await file.close(); }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed journal names within checked root-owned directory
      await rename(next, destination);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fsync the validated containing directory after rename
      const parent = await open(directory, constants.O_RDONLY);
      try { await parent.sync(); } finally { await parent.close(); }
    },
  };
}

/** Linux flock is retained by the parent's open file description, released on death. */
export async function withEmbeddedMigrationJournal(directory, callback) {
  await assertProtectedMigrationDirectory(directory);
  const lock = await checkedFile(join(directory, 'migration.lock'), constants.O_RDWR | constants.O_CREAT);
  try {
    const result = spawnSync('/bin/busybox', ['flock', '-n', '3'], {
      stdio: ['ignore', 'ignore', 'ignore', lock.fd], env: {}, timeout: 5000, shell: false,
    });
    if (result.error || result.status !== 0) throw new Error('migration_lock_unavailable');
    return await callback({ ...receiptStore(directory, 'migration'), selection: receiptStore(directory, 'selection') });
  } finally { await lock.close(); }
}
