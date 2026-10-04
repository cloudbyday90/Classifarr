/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdir, chown, chmod, readFile, readdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { ADMIN_ROLE, DATABASE, RESTORED_DATABASE, RUNTIME_ROLE, STATE, PG_DATA, SOCKET,
  HBA, IDENT, assertDrillEnvironment, assertContainerLayout } from './embeddedIsolationDrill/contract.mjs';
import { asUser, startRuntime, waitForRuntime, stopRuntime } from './embeddedIsolationDrill/processes.mjs';

const pg = (command, args, options = {}) => asUser('postgres', command, args, { admin: true, ...options });
const sql = (text, database = DATABASE) => pg('psql', ['-X', '-v', 'ON_ERROR_STOP=1',
  '-h', SOCKET, '-U', ADMIN_ROLE, '-d', database, '-c', text]);
const maintain = () => pg('node', ['src/scripts/runDatabaseSchemaMaintenance.mjs', '--apply']);
const probe = () => asUser('classifarr', 'node', ['src/scripts/embeddedIsolationDrill/runtimeProbe.mjs']);
const classificationReceipt = async (restored = false) => (await asUser('classifarr', 'node',
  ['src/scripts/embeddedIsolationDrill/classificationProbe.mjs', restored ? '--verify-restored' : '--verify'],
  { restored, timeout: 40_000 })).stdout.trim();
const stopDatabase = () => pg('pg_ctl', ['-D', PG_DATA, '-m', 'fast', '-w', '-t', '20', 'stop']);
const startDatabase = () => pg('pg_ctl', ['-D', PG_DATA, '-l', `${STATE}/postgres.log`, '-w', '-t', '30', 'start']);
const assertNoStartupErrors = () => sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM error_log WHERE level = 'ERROR') THEN RAISE EXCEPTION 'runtime_startup_errors_recorded'; END IF; END $$;");

async function prepare() {
  assertContainerLayout(await readFile('/proc/self/mountinfo', 'utf8'), await readdir('/sys/class/net'));
  assert.equal((await readdir('/rehearsal')).length, 0, 'refusing non-empty rehearsal state');
  const passwd = await readFile('/etc/passwd', 'utf8');
  const fields = passwd.split('\n').find(row => row.startsWith('postgres:'))?.split(':');
  const uid = Number(fields?.[2]), gid = Number(fields?.[3]);
  assert(Number.isInteger(uid) && uid > 0 && uid !== 1000 && Number.isInteger(gid));
  for (const path of [STATE, PG_DATA, SOCKET]) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed scratch mount paths checked above
    await mkdir(path, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed scratch mount paths checked above
    await chown(path, uid, gid);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed scratch mount paths checked above
    await chmod(path, path === SOCKET ? 0o755 : 0o700);
  }
  await chown('/app/data', 1000, 1000);
  await pg('initdb', ['-D', PG_DATA, '-U', ADMIN_ROLE, '--auth-local=peer', '--auth-host=reject', '--encoding=UTF8', '--locale=C']);
  await writeFile('/rehearsal/postgres/pg_hba.conf', HBA);
  await writeFile('/rehearsal/postgres/pg_ident.conf', IDENT);
  await writeFile('/rehearsal/postgres/postgresql.auto.conf', "listen_addresses = ''\nunix_socket_directories = '/run/postgresql'\nshared_preload_libraries = 'pg_stat_statements'\nmax_connections = 30\nshared_buffers = '64MB'\n");
}

async function assertCleanDatabase() {
  const { stdout } = await pg('pg_controldata', [PG_DATA]);
  assert.match(stdout, /Database cluster state:\s+shut down\s*\n/);
}

export async function runEmbeddedIsolationDrill() {
  assertDrillEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform });
  assert.equal(process.argv.length, 2);
  const started = performance.now();
  let runtime, databaseStarted = false;
  const checks = [];
  const record = name => { checks.push(name); process.stdout.write(`PASS ${name}\n`); };
  try {
    await prepare();
    await startDatabase();
    databaseStarted = true;
    await pg('createdb', ['-h', SOCKET, '-U', ADMIN_ROLE, DATABASE]);
    await maintain();
    await maintain();
    await sql(`CREATE ROLE ${RUNTIME_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC;
      GRANT CONNECT ON DATABASE ${DATABASE} TO ${RUNTIME_ROLE};
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT USAGE ON SCHEMA public TO ${RUNTIME_ROLE};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RUNTIME_ROLE};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RUNTIME_ROLE};
      CREATE TABLE isolation_sentinel(id integer PRIMARY KEY, value text NOT NULL);
      INSERT INTO isolation_sentinel VALUES (1, 'preserved');`);
    await probe();
    record('fresh_schema_repeat_maintenance_and_runtime_boundary');
    runtime = startRuntime({ classification: true });
    await waitForRuntime(runtime);
    const classified = await classificationReceipt();
    assert.equal((await fetch('http://127.0.0.1:21324/api/libraries', { signal: AbortSignal.timeout(2000) })).status, 401);
    await assert.rejects(maintain(), error => error.code === 75);
    await pg('node', ['src/scripts/embeddedIsolationDrill/restoreProbe.mjs', '--busy']);
    await stopRuntime(runtime);
    runtime = null;
    await assertNoStartupErrors();
    record('real_runtime_health_auth_maintenance_exclusion_and_sigterm');
    record('restricted_application_movie_tv_classification_and_persistence');

    await pg('node', ['src/scripts/embeddedIsolationDrill/restoreProbe.mjs', '--apply']);
    record('encrypted_restore_process_exclusion_quarantine_and_explicit_recovery');

    await asUser('root', 'node', ['src/scripts/embeddedIsolationDrill/handoffProbe.mjs'], { timeout: 300_000 });
    record('supervisor_schema_restore_handoff_before_runtime_and_clean_shutdown');

    await asUser('root', 'node', ['src/scripts/embeddedIsolationDrill/queueHandoffProbe.mjs'], { timeout: 300_000 });
    record('restricted_runtime_queue_handoff_independent_admission_and_budget_denial');

    // Privileged commands run only after the actual normal process has exited.
    await pg('pg_dump', ['-h', SOCKET, '-U', ADMIN_ROLE, '-d', DATABASE, '-Fc', '-f', `${STATE}/backup.dump`]);
    await pg('createdb', ['-h', SOCKET, '-U', ADMIN_ROLE, RESTORED_DATABASE]);
    await pg('pg_restore', ['-h', SOCKET, '-U', ADMIN_ROLE, '-d', RESTORED_DATABASE, '--exit-on-error', `${STATE}/backup.dump`]);
    await sql(`REVOKE ALL ON DATABASE ${RESTORED_DATABASE} FROM PUBLIC;
      GRANT CONNECT ON DATABASE ${RESTORED_DATABASE} TO ${RUNTIME_ROLE};`, RESTORED_DATABASE);
    await pg('node', ['src/scripts/embeddedIsolationDrill/maintenanceProbe.mjs'], { restored: true });
    await asUser('classifarr', 'node', ['src/scripts/embeddedIsolationDrill/runtimeProbe.mjs', '--restored'], { restored: true });
    assert.equal(await classificationReceipt(true), classified, 'restored_classification_changed');
    record('stopped_runtime_dump_restore_and_real_image_index_rebuild');

    await stopDatabase();
    databaseStarted = false;
    await assertCleanDatabase();
    await startDatabase();
    databaseStarted = true;
    assert.doesNotMatch(await readFile('/rehearsal/postgres.log', 'utf8'), /database system was interrupted|automatic recovery in progress/i);
    await probe();
    await sql("DO $$ BEGIN IF (SELECT value FROM isolation_sentinel WHERE id = 1) IS DISTINCT FROM 'preserved' THEN RAISE EXCEPTION 'sentinel_lost'; END IF; END $$;");
    runtime = startRuntime();
    await waitForRuntime(runtime);
    assert.equal(await classificationReceipt(), classified, 'restarted_classification_changed');
    await stopRuntime(runtime);
    runtime = null;
    await assertNoStartupErrors();
    record('clean_postgres_restart_preserved_data_and_runtime_readmission');
    await asUser('root', 'node', ['src/scripts/embeddedIsolationDrill/identityMigrationProbe.mjs'], { timeout: 300_000 });
    record('legacy_identity_copy_resume_crash_recovery_and_old_credential_denial');
  } finally {
    try { await stopRuntime(runtime); }
    finally {
      if (databaseStarted) { await stopDatabase(); await assertCleanDatabase(); }
    }
  }
  return { status: 'passed', checks, elapsedMs: Math.round(performance.now() - started),
    maximumRssKiB: process.resourceUsage().maxRSS, productionCutover: false };
}

if (import.meta.main) {
  try { process.stdout.write(`${JSON.stringify(await runEmbeddedIsolationDrill())}\n`); }
  catch (error) {
    // Synthetic isolated data only; bounded diagnostics, no live credentials are provided.
    process.stderr.write(`Embedded boundary failed: ${error.message}\n${String(error.stderr ?? '').slice(-4000)}\n`);
    process.exitCode = 1;
  }
}
