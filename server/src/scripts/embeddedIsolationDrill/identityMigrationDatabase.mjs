/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { readEmbeddedAccounts, parseEmbeddedId } from '../../bootstrap/embeddedIdentityPolicy.mjs';
import { childEnvironment } from './contract.mjs';

export const MIGRATION_ROOT = '/identity-migration';
export const SOURCE = '/identity-migration/source';
export const CANDIDATE = '/identity-migration/candidate';
export const MIGRATION_SOCKET = '/identity-migration/socket';
export const MIGRATION_DATABASE = 'classifarr_identity_migration';
export const migrationEnvironment = () => ({ ...childEnvironment({ admin: true }),
  POSTGRES_HOST: MIGRATION_SOCKET, POSTGRES_DB: MIGRATION_DATABASE });

const execute = promisify(execFile);
export async function databaseIdentity() {
  const accounts = readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8'));
  const account = accounts.users.find(user => user.name === 'postgres');
  const uid = parseEmbeddedId(account?.uid), gid = parseEmbeddedId(account?.gid);
  if (uid === 1000 || gid === 1000) throw new Error('migration_identity_collision');
  return { uid, gid };
}

// Fixed drill command vocabulary, isolated socket and minimal environment. Never the live pool.
export async function migrationCommand(user, command, args) {
  if ((!['postgres', 'classifarr'].includes(user) && !(user === 'root' && command === 'pg_controldata'))
    || !['pg_ctl', 'pg_controldata', 'initdb', 'createdb', 'psql', 'node'].includes(command)) {
    throw new Error('migration_command_invalid');
  }
  return execute('/sbin/su-exec', [user, command, ...args], { cwd: '/app', shell: false,
    env: migrationEnvironment(), timeout: 120_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
}

export const candidateStop = () => migrationCommand('postgres', 'pg_ctl', ['-D', CANDIDATE, '-m', 'fast', '-w', '-t', '20', 'stop']);
export const candidateStart = () => migrationCommand('postgres', 'pg_ctl', ['-D', CANDIDATE,
  '-l', `${CANDIDATE}/migration.log`, '-o', '-c config_file=/identity-migration/postgresql.conf', '-w', '-t', '30', 'start']);
export const migrationSql = (text, user = 'postgres') => migrationCommand(user, 'psql', ['-X', '-v', 'ON_ERROR_STOP=1',
  '-h', MIGRATION_SOCKET, '-U', 'classifarr', '-d', MIGRATION_DATABASE, '-At', '-c', text]);

export const IDENTITY_ROLE_SQL = `BEGIN;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='2s';
SET LOCAL transaction_timeout='20s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cf_runtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cf_runtime'
      AND shobj_description(oid,'pg_authid')='classifarr.embedded-runtime.v1'
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)
      OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='cf_runtime'))
    THEN RAISE EXCEPTION 'migration_runtime_role_collision'; END IF;
  ELSE
    CREATE ROLE cf_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
    COMMENT ON ROLE cf_runtime IS 'classifarr.embedded-runtime.v1';
  END IF;
END $$;
ALTER ROLE classifarr PASSWORD NULL;
ALTER ROLE cf_runtime PASSWORD NULL;
REVOKE ALL ON DATABASE classifarr_identity_migration FROM PUBLIC;
GRANT CONNECT ON DATABASE classifarr_identity_migration TO cf_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cf_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO cf_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO cf_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE classifarr IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO cf_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE classifarr IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO cf_runtime;
COMMIT;`;
