/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { lstat, readdir, open, mkdir, copyFile, chmod, chown } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/** Offline, exclusively controlled tree only. External WAL/tablespaces are refused. */
export async function inspectMigrationTree(root, { maxEntries = 50000, maxBytes = 8 * 1024 ** 3, signal, identity } = {}) {
  signal?.throwIfAborted();
  const entries = [];
  let bytes = 0;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- trusted cold cluster path; symlinks and mount crossings rejected below
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('migration_tree_unsupported');
  const device = rootStat.dev;
  async function visit(relative, depth = 0) {
    signal?.throwIfAborted();
    if (depth > 64) throw new Error('migration_tree_budget_exceeded');
    const path = join(root, relative);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- enumerated path; lstat rejects symlinks before traversal
    const stat = await lstat(path);
    signal?.throwIfAborted();
    if (stat.dev !== device || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1)) {
      throw new Error('migration_tree_unsupported');
    }
    if (identity && (stat.uid !== identity.uid || stat.gid !== identity.gid || (stat.mode & 0o077))) {
      throw new Error('migration_tree_permissions_invalid');
    }
    bytes += stat.isFile() ? stat.size : 0;
    if (entries.length >= maxEntries || bytes > maxBytes) throw new Error('migration_tree_budget_exceeded');
    entries.push({ relative, directory: stat.isDirectory() });
    if (stat.isDirectory()) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- no symlink directories; same-device, bounded tree
      for (const name of (await readdir(path)).sort()) await visit(join(relative, name), depth + 1);
    }
  }
  await visit('');
  return { entries, bytes };
}

export async function digestMigrationTree(root, tree, { signal } = {}) {
  signal?.throwIfAborted();
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(1024 * 1024);
  for (const entry of tree.entries) {
    signal?.throwIfAborted();
    hash.update(JSON.stringify([entry.relative, entry.directory]));
    if (entry.directory) continue;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated regular-file entry, never follow a replaced symlink
    const file = await open(join(root, entry.relative), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.nlink !== 1) throw new Error('migration_tree_changed');
      const content = createHash('sha256');
      let consumed = 0;
      for (;;) {
        signal?.throwIfAborted();
        const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
        signal?.throwIfAborted();
        if (!bytesRead) break;
        consumed += bytesRead;
        if (consumed > stat.size) throw new Error('migration_tree_changed');
        content.update(buffer.subarray(0, bytesRead));
      }
      if (consumed !== stat.size) throw new Error('migration_tree_changed');
      hash.update(content.digest());
    } finally { await file.close(); }
  }
  return hash.digest('hex');
}

export async function copyMigrationTree(source, target, tree, { signal } = {}) {
  signal?.throwIfAborted();
  for (const entry of tree.entries) {
    signal?.throwIfAborted();
    const destination = join(target, entry.relative);
    if (entry.directory) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- new protected candidate, exclusive caller lease
      await mkdir(destination, { mode: 0o700 });
    } else {
      // Preflighted cold regular-file tree; never overwrite candidate files.
      await copyFile(join(source, entry.relative), destination, constants.COPYFILE_EXCL);
      signal?.throwIfAborted();
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- fsync copied candidate before durable receipt
      const file = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { await file.sync(); } finally { await file.close(); }
    }
  }
  for (const entry of tree.entries.filter(entry => entry.directory).reverse()) {
    signal?.throwIfAborted();
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fsync the copied directories bottom-up
    const file = await open(join(target, entry.relative), constants.O_RDONLY);
    try { await file.sync(); } finally { await file.close(); }
  }
  signal?.throwIfAborted();
}

export async function ownMigrationTree(root, tree, uid, gid) {
  for (const entry of tree.entries) {
    const path = join(root, entry.relative);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- preflighted offline candidate under exclusive lease
    await chown(path, uid, gid);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- remove group/other access to candidate database files
    await chmod(path, entry.directory ? 0o700 : 0o600);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- persist ownership and mode before journaling completion
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await file.sync(); } finally { await file.close(); }
  }
}
