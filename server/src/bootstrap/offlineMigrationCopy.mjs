/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { lstat, rm, statfs, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertProtectedMigrationDirectory } from './embeddedMigrationJournal.mjs';
import { inspectMigrationTree, digestMigrationTree, copyMigrationTree } from './embeddedMigrationTree.mjs';
import { validateMigrationReceipt } from './embeddedMigrationPhases.mjs';
import { readOfflineMigrationSource } from './offlineMigrationSource.mjs';
import { migrationSourceBinding, validateOfflineMigrationPaths } from './offlineMigrationSourceRecord.mjs';
import { SELECTED_DATABASE_DATA } from './embeddedSelectedDatabaseLayout.mjs';

async function exists(path) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- trusted composition path only; lstat never follows a candidate link
  try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function syncParent(path) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- already validated root-protected candidate parent
  const file = await open(dirname(path), 'r');
  try { await file.sync(); } finally { await file.close(); }
}

/** Caller retains the journal lease AND offline isolation. Never a saved-path API.
 * No account provisioning, candidate activation, role changes or source mutation.
 */
export async function prepareOfflineMigrationCopy({ journal, source = '/app/data/postgres', candidate = SELECTED_DATABASE_DATA,
  signal = AbortSignal.timeout(300_000), platform = process.platform, uid = process.getuid?.(), read = readOfflineMigrationSource,
  present = exists, inspect = inspectMigrationTree, digest = digestMigrationTree, copy = copyMigrationTree,
  remove = rm, space = statfs, protect = assertProtectedMigrationDirectory, sync = syncParent,
}) {
  if (platform !== 'linux' || uid !== 0 || typeof journal?.source?.read !== 'function'
    || typeof journal.source.write !== 'function' || typeof journal.selection?.read !== 'function'
    || typeof journal.read !== 'function') throw new Error('migration_source_context_invalid');
  validateOfflineMigrationPaths(source, candidate); signal?.throwIfAborted();
  const saved = await journal.source.read();
  if (saved === null && (await journal.read() !== null || await journal.selection.read() !== null || await present(candidate))) {
    throw new Error('migration_source_provenance_missing');
  }
  if (saved !== null) migrationSourceBinding(saved);
  const initial = await read({ source, candidate, signal });
  const binding = migrationSourceBinding(initial.record);
  if (saved !== null && migrationSourceBinding(saved) !== binding) throw new Error('migration_source_changed');
  signal?.throwIfAborted();
  // Re-sync after an earlier rename with uncertain directory fsync, even on resume.
  await journal.source.write(initial.record);
  const unchanged = async () => {
    signal?.throwIfAborted();
    if (migrationSourceBinding(await journal.source.read()) !== binding) throw new Error('migration_source_changed');
    const current = await read({ source, candidate, signal });
    if (migrationSourceBinding(current.record) !== binding) throw new Error('migration_source_changed');
    return current;
  };
  return { binding, record: initial.record, verifySource: unchanged, copy: async () => {
    signal?.throwIfAborted();
    const receipt = validateMigrationReceipt(await journal.read(), binding);
    if (receipt.completed !== 0 || receipt.pending !== 'copy' || await journal.selection.read() !== null) {
      throw new Error('migration_copy_not_admitted');
    }
    const current = await unchanged();
    await protect(dirname(candidate));
    const available = await space(dirname(candidate));
    if (!Number.isSafeInteger(available.bavail) || !Number.isSafeInteger(available.bsize)
      || available.bavail < 0 || available.bsize <= 0
      || BigInt(available.bavail) * BigInt(available.bsize) < BigInt(Math.ceil(current.record.bytes * 1.1))) {
      throw new Error('migration_space_insufficient');
    }
    if (await present(candidate)) {
      const tree = await inspect(candidate, { signal });
      if (tree.entries.some(entry => entry.relative === 'postmaster.pid')) throw new Error('migration_candidate_not_stopped');
      signal?.throwIfAborted();
      // Canonical, non-overlapping candidate only; protected parent + regular tree
      // + exact pending-copy receipt + no selection were checked before deletion.
      await remove(candidate, { recursive: true });
    }
    signal?.throwIfAborted();
    await copy(source, candidate, current.tree, { signal });
    await sync(candidate); signal?.throwIfAborted();
    if (await digest(candidate, await inspect(candidate, { signal }), { signal }) !== current.record.digest) {
      throw new Error('migration_copy_digest_mismatch');
    }
    await unchanged();
  } };
}
