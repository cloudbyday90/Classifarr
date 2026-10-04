/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { assertFenceRehearsalDatabase, fenceRole, FENCE_TABLES } from './contract.mjs';

/** Dedicated admin connection to an owned suite database, never the application pool. */
export async function prepareFenceRehearsal(db) {
  await assertFenceRehearsalDatabase(db);
  const suffix = randomBytes(6).toString('hex');
  const identities = Object.fromEntries(['owner', 'writer', 'legacy'].map(kind =>
    [kind, { user: fenceRole(`cf_fence_${kind}_${suffix}`), password: randomBytes(32).toString('hex') }]));
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='15s'");
    for (const [kind, identity] of Object.entries(identities)) {
      // sql-interpolation: generated validated identifiers and hex-only random passwords, no user text
      await db.query(`CREATE ROLE ${identity.user} ${kind === 'owner' ? 'NOLOGIN' : 'LOGIN'}
        ${kind === 'legacy' ? 'SUPERUSER' : 'NOSUPERUSER'} NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
        PASSWORD '${identity.password}'`);
    }
    const owner = identities.owner.user, writer = identities.writer.user;
    await db.query(`GRANT pg_read_all_stats TO ${owner}`); // sql-interpolation: private definer reads backend start identity; runtime cannot assume owner
    await db.query(`CREATE SCHEMA ingestion_fence_rehearsal AUTHORIZATION ${owner}`); // sql-interpolation: validated generated role
    await db.query('REVOKE ALL ON SCHEMA ingestion_fence_rehearsal FROM PUBLIC');
    await db.query(`GRANT USAGE ON SCHEMA public,ingestion_fence_rehearsal TO ${owner},${writer}`); // sql-interpolation: validated generated roles
    await db.query(`GRANT SELECT ON public.libraries,public.media_server,public.library_ingestion_state,
      public.media_server_items,public.library_profile_inventory_state TO ${owner}`); // sql-interpolation: validated generated role
    await db.query(`GRANT UPDATE(id) ON public.libraries,public.media_server TO ${owner}`); // sql-interpolation: required for FOR SHARE, no runtime membership
    await db.query(`GRANT REFERENCES(id) ON public.libraries TO ${owner}`); // sql-interpolation: binding foreign key only
    await db.query(`GRANT INSERT,UPDATE ON public.library_ingestion_state,public.media_server_items,
      public.library_profile_inventory_state TO ${owner}`); // sql-interpolation: validated generated role
    await db.query(`GRANT SELECT,UPDATE ON public.media_server_sync_status,public.media_source_capture_state TO ${owner}`); // sql-interpolation: validated generated role
    await db.query(`GRANT USAGE ON SEQUENCE public.media_server_items_id_seq TO ${owner}`); // sql-interpolation: validated generated role
    await db.query(`SET LOCAL ROLE ${owner}`); // sql-interpolation: trusted non-login function owner
    for (const file of ['lifecycle.sql', 'write.sql', 'authority.sql']) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixed adjacent SQL files; no caller-supplied path.
      await db.query(await readFile(new URL(file, import.meta.url), 'utf8'));
    }
    // COMMIT in a top-level procedure prevents accidentally wrapping retirement in an outer
    // transaction where NOLOGIN would remain invisible while other legacy sessions reconnect.
    await db.query(`CREATE PROCEDURE ingestion_fence_rehearsal.retire_legacy()
      LANGUAGE plpgsql SECURITY INVOKER AS $$ BEGIN
        ALTER ROLE ${identities.legacy.user} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
        COMMIT;
      END $$`); // sql-interpolation: fixed procedure and validated generated legacy role
    await db.query('REVOKE ALL ON ALL ROUTINES IN SCHEMA ingestion_fence_rehearsal FROM PUBLIC');
    await db.query(`GRANT EXECUTE ON FUNCTION ingestion_fence_rehearsal.begin_run(integer),
      ingestion_fence_rehearsal.write_item(integer,uuid,text,text),
      ingestion_fence_rehearsal.finish_run(integer,uuid,integer) TO ${writer}`); // sql-interpolation: validated generated role
    await db.query('RESET ROLE');
    await db.query('UPDATE ingestion_fence_rehearsal.cutover SET owner_role=$1,writer_role=$2,legacy_role=$3',
      [owner, writer, identities.legacy.user]);
    await db.query('COMMIT');
    return identities;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

/** Multi-stage cutover: denial/drain precedes the atomic boundary receipt. Failure stays closed. */
export async function cutOverFenceRehearsal(db, identities) {
  await assertFenceRehearsalDatabase(db);
  const legacy = fenceRole(identities.legacy.user), owner = fenceRole(identities.owner.user);
  const writer = fenceRole(identities.writer.user);
  const registration = (await db.query('SELECT * FROM ingestion_fence_rehearsal.cutover')).rows[0];
  if (registration?.enabled !== false || registration.owner_role !== owner ||
    registration.writer_role !== writer || registration.legacy_role !== legacy) {
    throw new Error('ingestion_fence_cutover_not_pending');
  }
  const { rows: [scope] } = await db.query(`SELECT
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)) AS membership,
    EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND datname<>current_database()) AS foreign_session`, [legacy]);
  if (scope.membership || scope.foreign_session) throw new Error('ingestion_fence_legacy_scope_not_isolated');
  // This statement commits before terminating sessions. NOLOGIN does not stop existing sessions.
  await db.query('CALL ingestion_fence_rehearsal.retire_legacy()');
  await db.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE usename=$1 AND datname=current_database() AND pid<>pg_backend_pid()`, [legacy]);
  let drained = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    const { rows: [row] } = await db.query('SELECT count(*)::integer n FROM pg_stat_activity WHERE usename=$1', [legacy]);
    if (row.n === 0) { drained = true; break; }
    await delay(20);
  }
  if (!drained) throw new Error('ingestion_fence_legacy_sessions_remain');
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='1s'; SET LOCAL transaction_timeout='15s'");
    await db.query(`LOCK TABLE ${FENCE_TABLES.map(name => `public.${name}`).join(',')} IN ACCESS EXCLUSIVE MODE`); // sql-interpolation: fixed relation allowlist
    await db.query(`REASSIGN OWNED BY ${legacy} TO ${owner}`); // sql-interpolation: owned disposable database roles only
    await db.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${legacy},${writer},PUBLIC`); // sql-interpolation: validated generated roles
    await db.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${legacy},${writer},PUBLIC`); // sql-interpolation: validated generated roles
    await db.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${legacy},${writer},PUBLIC`); // sql-interpolation: no ambient definer execution
    await db.query(`REVOKE CREATE ON SCHEMA public FROM ${legacy},${writer},PUBLIC`); // sql-interpolation: validated generated roles
    await db.query(`GRANT EXECUTE ON FUNCTION public.mark_library_profile_inventory_changed(bigint[]),
      public.library_profile_observed_metadata(jsonb) TO ${owner}`); // sql-interpolation: fixed trigger dependency allowlist
    await db.query('UPDATE ingestion_fence_rehearsal.cutover SET enabled=true');
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}
