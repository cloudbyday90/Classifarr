/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { constants } from 'node:fs';
import { lstat, open, readFile } from 'node:fs/promises';
import { assertProtectedMigrationDirectory } from './embeddedMigrationJournal.mjs';
import { parseEmbeddedId, readEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';

export const SELECTED_DATABASE_ROOT = '/app/data/embedded-postgres';
export const SELECTED_DATABASE_DATA = '/app/data/embedded-postgres/candidate';
export const SELECTED_DATABASE_SOCKET = '/app/data/embedded-postgres/socket';
const FILES = Object.freeze({
  config: '/app/data/embedded-postgres/postgresql.conf',
  hba: '/app/data/embedded-postgres/pg_hba.conf',
  ident: '/app/data/embedded-postgres/pg_ident.conf',
  auto: '/app/data/embedded-postgres/candidate/postgresql.auto.conf',
  version: '/app/data/embedded-postgres/candidate/PG_VERSION',
  pid: '/app/data/embedded-postgres/candidate/postmaster.pid',
});

/** Fixed allowlist, no followed link or unbounded read. Dependencies are test seams. */
export async function readSelectedDatabaseFile(kind, uid, { signal, openFile = open } = {}) {
  if (!Object.hasOwn(FILES, kind)) throw new Error('selected_database_file_invalid');
  signal?.throwIfAborted();
  const limit = ['config', 'hba', 'ident'].includes(kind) ? 65536 : 2048;
  // Exact private fixed-path allowlist, never caller paths.
  const file = await openFile(FILES[kind], constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    signal?.throwIfAborted();
    if (!stat.isFile() || stat.uid !== uid || stat.nlink !== 1 || (stat.mode & 0o022) || stat.size >= limit) {
      throw new Error('selected_database_file_invalid');
    }
    const buffer = Buffer.alloc(limit);
    let offset = 0;
    while (offset < limit) {
      const { bytesRead } = await file.read(buffer, offset, limit - offset, offset);
      signal?.throwIfAborted();
      if (!bytesRead) return buffer.toString('utf8', 0, offset);
      offset += bytesRead;
    }
    throw new Error('selected_database_file_invalid');
  } finally { await file.close(); }
}

/** Admission only: no chmod, chown, PID removal, path creation or fallback. */
export async function prepareSelectedDatabase({ signal, protect = assertProtectedMigrationDirectory,
  stat = lstat, read = readSelectedDatabaseFile, accounts = async () => readEmbeddedAccounts(
    await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')),
} = {}) {
  signal?.throwIfAborted();
  await protect(SELECTED_DATABASE_ROOT);
  signal?.throwIfAborted();
  const users = (await accounts()).users;
  const database = users.find(user => user.name === 'postgres');
  const app = users.find(user => user.name === 'classifarr');
  const uid = parseEmbeddedId(database?.uid), gid = parseEmbeddedId(database?.gid);
  parseEmbeddedId(app?.uid); parseEmbeddedId(app?.gid);
  signal?.throwIfAborted();
  if (!app || uid === app.uid || gid === app.gid || users.some(user => user.uid === uid && user.name !== 'postgres')) {
    throw new Error('selected_database_identity_collision');
  }
  for (const path of [SELECTED_DATABASE_DATA, SELECTED_DATABASE_SOCKET]) {
    // Fixed protected children; reject links before use.
    const entry = await stat(path);
    signal?.throwIfAborted();
    if (!entry.isDirectory() || entry.isSymbolicLink() || entry.uid !== uid || entry.gid !== gid
      || (entry.mode & (path === SELECTED_DATABASE_DATA ? 0o077 : 0o022))) {
      throw new Error('selected_database_directory_invalid');
    }
  }
  for (const kind of ['config', 'hba', 'ident']) await read(kind, 0, { signal });
  if ((await read('auto', uid, { signal })).trim() !== '' || (await read('version', uid, { signal })).trim() !== '18') {
    throw new Error('selected_database_configuration_invalid');
  }
  try { await read('pid', uid, { signal }); }
  catch (error) { if (error.code === 'ENOENT') { signal?.throwIfAborted(); return { uid, gid }; } throw error; }
  throw new Error('selected_database_not_stopped');
}
