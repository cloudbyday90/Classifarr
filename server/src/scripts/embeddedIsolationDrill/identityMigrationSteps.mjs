/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, lstat, rm, writeFile, chown, chmod, open, statfs } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectMigrationTree, digestMigrationTree, copyMigrationTree, ownMigrationTree } from '../../bootstrap/embeddedMigrationTree.mjs';
import { assertProtectedMigrationDirectory } from '../../bootstrap/embeddedMigrationJournal.mjs';
import { assertDrillEnvironment } from './contract.mjs';
import { SOURCE, CANDIDATE, MIGRATION_ROOT, MIGRATION_SOCKET, databaseIdentity,
  migrationCommand, candidateStart, candidateStop, migrationSql, IDENTITY_ROLE_SQL } from './identityMigrationDatabase.mjs';

const absent = async path => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed offline candidate/source files from this module
  try { await lstat(path); return false; } catch (error) { if (error.code === 'ENOENT') return true; throw error; }
};
const control = async (path, user) => (await migrationCommand(user, 'pg_controldata', [path])).stdout;
const systemId = text => text.match(/Database system identifier:\s+(\d+)/)?.[1];
const clean = text => assert.match(text, /Database cluster state:\s+shut down\s*\n/);

export async function prepareIdentityMigration({ checkpoint = async () => {} } = {}) {
  assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  await assertProtectedMigrationDirectory(MIGRATION_ROOT);
  const identity = await databaseIdentity();
  const originalControl = await control(SOURCE, 'classifarr');
  clean(originalControl);
  assert(await absent(`${SOURCE}/postmaster.pid`), 'legacy_database_not_stopped');
  assert.equal((await readFile('/identity-migration/source/PG_VERSION', 'utf8')).trim(), '18');
  const tree = await inspectMigrationTree(SOURCE);
  const digest = await digestMigrationTree(SOURCE, tree);
  const binding = createHash('sha256').update(JSON.stringify({ contract: 1, systemId: systemId(originalControl),
    digest, identity, source: SOURCE, candidate: CANDIDATE })).digest('hex');
  const stopCandidate = async () => {
    if (!(await absent(`${CANDIDATE}/postmaster.pid`))) await candidateStop();
  };
  const verify = async () => {
    await candidateStart();
    try {
      assert.equal((await migrationSql("SELECT count(*) FROM pg_authid WHERE rolname IN ('classifarr','cf_runtime') AND rolpassword IS NOT NULL")).stdout.trim(), '0');
      assert.equal((await migrationSql('SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL')).stdout.trim(), '0');
      await migrationCommand('classifarr', 'node', ['src/scripts/embeddedIsolationDrill/identityMigrationRuntimeProbe.mjs']);
    } finally { await candidateStop(); }
    clean(await control(CANDIDATE, 'postgres'));
    assert.equal(await digestMigrationTree(SOURCE, await inspectMigrationTree(SOURCE)), digest);
  };
  return { binding, steps: {
    prepare: async receipt => {
      if (receipt.completed === 0 && receipt.pending === null) assert(await absent(CANDIDATE), 'unregistered_candidate');
      if (!(await absent(CANDIDATE))) {
        // Do not follow a substituted candidate even to stop it.
        await inspectMigrationTree(CANDIDATE);
        if (receipt.completed > 0) assert.equal(systemId(await control(CANDIDATE, 'root')), systemId(originalControl));
        await stopCandidate();
      }
    },
    copy: async () => {
      const space = await statfs(MIGRATION_ROOT);
      assert(space.bavail * space.bsize >= tree.bytes * 1.1, 'migration_space_insufficient');
      // Only this unpublished, journal-registered fixed candidate is replaced on copy retry.
      // The checked root-owned parent cannot be changed by either runtime identity.
      await rm(CANDIDATE, { recursive: true, force: true });
      await copyMigrationTree(SOURCE, CANDIDATE, tree);
      assert.equal(await digestMigrationTree(CANDIDATE, await inspectMigrationTree(CANDIDATE)), digest);
      assert.equal(await digestMigrationTree(SOURCE, await inspectMigrationTree(SOURCE)), digest);
    },
    ownership: async () => {
      await ownMigrationTree(CANDIDATE, await inspectMigrationTree(CANDIDATE), identity.uid, identity.gid);
      await chown('/identity-migration/socket', identity.uid, identity.gid);
      await chmod('/identity-migration/socket', 0o755);
    },
    authentication: async () => {
      // No legacy includes, preload paths, archive commands or trust rules are inherited.
      const files = [
        ['/identity-migration/pg_hba.conf', 'local all classifarr peer map=maintenance\nlocal classifarr_identity_migration cf_runtime peer map=runtime\nlocal all all reject\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n'],
        ['/identity-migration/pg_ident.conf', 'maintenance postgres classifarr\nruntime classifarr cf_runtime\n'],
        ['/identity-migration/postgresql.conf', `data_directory='${CANDIDATE}'\nhba_file='/identity-migration/pg_hba.conf'\nident_file='/identity-migration/pg_ident.conf'\nlisten_addresses=''\nunix_socket_directories='${MIGRATION_SOCKET}'\nshared_preload_libraries='pg_stat_statements'\nshared_buffers='32MB'\nmax_connections=20\n`],
        [`${CANDIDATE}/postgresql.auto.conf`, ''],
      ];
      for (const [path, content] of files) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed configuration allowlist in an exclusively leased scratch cluster
        await writeFile(path, content, { mode: 0o644 });
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- root owns new external policy; postgres owns empty candidate auto-conf
        await chmod(path, path.endsWith('postgresql.auto.conf') ? 0o600 : 0o644);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- durability before advancing authentication receipt
        const file = await open(path, 'r');
        try { await file.sync(); } finally { await file.close(); }
      }
    },
    roles: async () => {
      await candidateStart();
      try { await checkpoint('database-started'); await migrationSql(IDENTITY_ROLE_SQL); }
      finally { await candidateStop(); }
    },
    verification: verify,
  } };
}
