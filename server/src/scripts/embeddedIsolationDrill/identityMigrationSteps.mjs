/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { lstat, writeFile, chown, chmod, open } from 'node:fs/promises';
import { inspectMigrationTree, copyMigrationTree, ownMigrationTree } from '../../bootstrap/embeddedMigrationTree.mjs';
import { prepareOfflineMigrationCopy } from '../../bootstrap/offlineMigrationCopy.mjs';
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

export async function prepareIdentityMigration({ journal, checkpoint = async () => {}, partialCopy = false }) {
  assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  await assertProtectedMigrationDirectory(MIGRATION_ROOT);
  const identity = await databaseIdentity();
  const original = await prepareOfflineMigrationCopy({ journal, source: SOURCE, candidate: CANDIDATE,
    ...(partialCopy ? { copy: async (source, candidate, tree, options) => {
      // Actual durable partial tree, then real process death. Never normal behavior.
      await copyMigrationTree(source, candidate, { ...tree, entries: tree.entries.slice(0, 2) }, options);
      await checkpoint('partial-copy');
      throw new Error('partial_copy_fixture_not_interrupted');
    } } : {}),
  });
  await checkpoint('source-recorded');
  const { binding } = original;
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
    await original.verifySource();
  };
  return { binding, steps: {
    prepare: async receipt => {
      if (receipt.completed === 0 && receipt.pending === null) assert(await absent(CANDIDATE), 'unregistered_candidate');
      if (!(await absent(CANDIDATE))) {
        // Do not follow a substituted candidate even to stop it.
        await inspectMigrationTree(CANDIDATE);
        if (receipt.completed > 0) assert.equal(systemId(await control(CANDIDATE, 'root')), original.record.systemId);
        await stopCandidate();
      }
    },
    copy: original.copy,
    ownership: async () => {
      await ownMigrationTree(CANDIDATE, await inspectMigrationTree(CANDIDATE), identity.uid, identity.gid);
      await chown('/app/data/embedded-postgres/socket', identity.uid, identity.gid);
      await chmod('/app/data/embedded-postgres/socket', 0o755);
    },
    authentication: async () => {
      // No legacy includes, preload paths, archive commands or trust rules are inherited.
      const files = [
        ['/app/data/embedded-postgres/pg_hba.conf', 'local all classifarr peer map=maintenance\nlocal classifarr cf_runtime peer map=runtime\nlocal all all reject\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n'],
        ['/app/data/embedded-postgres/pg_ident.conf', 'maintenance postgres classifarr\nruntime classifarr cf_runtime\n'],
        ['/app/data/embedded-postgres/postgresql.conf', `data_directory='${CANDIDATE}'\nhba_file='/app/data/embedded-postgres/pg_hba.conf'\nident_file='/app/data/embedded-postgres/pg_ident.conf'\nlisten_addresses=''\nunix_socket_directories='${MIGRATION_SOCKET}'\nshared_preload_libraries='pg_stat_statements'\nshared_buffers='32MB'\nmax_connections=20\n`],
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
