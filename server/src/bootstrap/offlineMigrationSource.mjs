/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertProtectedMigrationDirectory } from './embeddedMigrationJournal.mjs';
import { inspectMigrationTree, digestMigrationTree } from './embeddedMigrationTree.mjs';
import { requireSeparatedEmbeddedAccounts, readEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';
import { readOfflineMigrationControl } from './offlineMigrationControl.mjs';
import { validateOfflineMigrationPaths, migrationSourceBinding } from './offlineMigrationSourceRecord.mjs';

async function readVersion(source) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- trusted validated offline cluster, fixed PG_VERSION leaf, no followed link
  const file = await open(join(source, 'PG_VERSION'), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 32) throw new Error('migration_source_version_invalid');
    const buffer = Buffer.alloc(33), result = await file.read(buffer, 0, buffer.length, 0);
    if (buffer.toString('utf8', 0, result.bytesRead).trim() !== '18') throw new Error('migration_source_version_invalid');
  } finally { await file.close(); }
}

/** Read-only observation, not proof that arbitrary external writers are fenced. */
export async function readOfflineMigrationSource({ source, candidate, signal,
  protect = assertProtectedMigrationDirectory, stat = lstat, version = readVersion,
  control = readOfflineMigrationControl, inspect = inspectMigrationTree, digest = digestMigrationTree,
  accounts = async () => readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')),
}) {
  validateOfflineMigrationPaths(source, candidate); signal?.throwIfAborted();
  for (const parent of new Set([dirname(source), dirname(candidate)])) await protect(parent);
  const { application, database } = requireSeparatedEmbeddedAccounts(await accounts());
  const metadata = await stat(source);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== application.uid
    || metadata.gid !== application.gid || (metadata.mode & 0o077)) throw new Error('migration_source_permissions_invalid');
  const tree = await inspect(source, { signal });
  if (tree.entries.some(entry => ['postmaster.pid', 'standby.signal', 'recovery.signal'].includes(entry.relative))) {
    throw new Error('migration_source_not_stopped');
  }
  await version(source); signal?.throwIfAborted();
  const systemId = await control(source, { signal });
  const sourceDigest = await digest(source, tree, { signal });
  if (await control(source, { signal }) !== systemId) throw new Error('migration_source_changed');
  signal?.throwIfAborted();
  const record = { version: 1, source, candidate, systemId, digest: sourceDigest, bytes: tree.bytes, entries: tree.entries.length,
    applicationUid: application.uid, applicationGid: application.gid, databaseUid: database.uid, databaseGid: database.gid };
  return { record, tree, binding: migrationSourceBinding(record) };
}
