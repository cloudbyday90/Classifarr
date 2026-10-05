/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';
import { waitForEmbeddedExit } from './embeddedChildProcess.mjs';
import { SELECTED_DATABASE_SOCKET } from './embeddedSelectedDatabaseLayout.mjs';

const sql = `BEGIN READ ONLY;
DO $$ DECLARE runtime oid; BEGIN
  SELECT oid INTO runtime FROM pg_catalog.pg_authid WHERE rolname='cf_runtime'
    AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls AND rolpassword IS NULL
    AND rolvaliduntil IS NULL
    AND pg_catalog.shobj_description(oid,'pg_authid')='classifarr.embedded-runtime.v1';
  IF runtime IS NULL OR current_user <> 'classifarr'
    OR NOT EXISTS (SELECT FROM pg_catalog.pg_authid WHERE rolname='classifarr' AND rolsuper AND rolpassword IS NULL)
    OR EXISTS (SELECT FROM pg_catalog.pg_auth_members WHERE member=runtime)
    OR EXISTS (SELECT FROM pg_catalog.pg_shdepend WHERE refclassid='pg_catalog.pg_authid'::regclass AND refobjid=runtime AND deptype='o')
    OR EXISTS (SELECT FROM pg_catalog.pg_db_role_setting WHERE setrole IN (0,runtime,(SELECT oid FROM pg_catalog.pg_roles WHERE rolname='classifarr'))
      AND setdatabase IN (0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=current_database())))
    OR EXISTS (SELECT FROM pg_catalog.pg_hba_file_rules WHERE error IS NOT NULL)
    OR NOT pg_catalog.has_database_privilege(runtime,current_database(),'CONNECT')
    OR pg_catalog.has_database_privilege(runtime,current_database(),'CREATE')
    OR pg_catalog.has_database_privilege(runtime,current_database(),'TEMP')
    OR NOT pg_catalog.has_schema_privilege(runtime,'public','USAGE')
    OR pg_catalog.has_schema_privilege(runtime,'public','CREATE')
  THEN RAISE EXCEPTION 'selected_migration_roles_invalid'; END IF;
END $$;
COMMIT;`;

/** Fixed read-only SQL only; never inherit client options, passwords or psqlrc. */
export async function verifySelectedMigrationRoles({ identity, signal, spawnFn = spawn }) {
  signal?.throwIfAborted();
  const child = spawnFn('/sbin/su-exec', [`${parseEmbeddedId(identity.uid)}:${parseEmbeddedId(identity.gid)}`,
    '/usr/libexec/postgresql18/psql', '-X', '-w', '-v', 'ON_ERROR_STOP=1',
    '-h', SELECTED_DATABASE_SOCKET, '-p', '5432', '-U', 'classifarr', '-d', 'classifarr', '-c', sql], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', PGCONNECT_TIMEOUT: '5',
      PGOPTIONS: '-c search_path=pg_catalog -c session_preload_libraries= -c local_preload_libraries= -c statement_timeout=5000 -c lock_timeout=1000 -c transaction_timeout=10000' },
  });
  const observed = observeEmbeddedMaintenance(child);
  let cancelled = false;
  const cancel = () => { cancelled = true; observed.signal('SIGKILL'); };
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 15_000);
  try {
    let result;
    try { result = await waitForEmbeddedExit(observed.done, 17_000); }
    catch { throw new Error('selected_migration_helper_unjoined'); }
    if (cancelled || result.code !== 0 || result.signal !== null) throw new Error('selected_migration_roles_invalid');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
