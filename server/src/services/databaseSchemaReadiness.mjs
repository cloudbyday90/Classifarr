/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { createMigrationRunner } from '../config/migrations.mjs';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';

// This checks runtime schema authority, not the complete DML/SECURITY DEFINER surface.
const RUNTIME_AUTHORITY_SQL = `
  SELECT current_user = session_user AS direct_login,
    NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls) AS restricted,
    NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles other
      WHERE other.oid <> r.oid AND pg_catalog.pg_has_role(r.oid, other.oid, 'MEMBER')) AS no_membership,
    NOT pg_catalog.has_database_privilege(current_database(), 'CREATE') AS no_database_create,
    NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
      WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
        AND pg_catalog.has_schema_privilege(n.oid, 'CREATE')) AS no_schema_create,
    NOT EXISTS (SELECT 1 FROM pg_catalog.pg_shdepend d
      WHERE d.refclassid = 'pg_catalog.pg_authid'::regclass AND d.refobjid = r.oid
        AND d.deptype = 'o' AND d.dbid IN (0,
          (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database()))) AS no_ownership
  FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
`;

export function requireMigrationFiles(runner) {
  const files = runner.getMigrationFiles();
  if (!files.length) throw new Error('schema_migration_files_unavailable');
  return files;
}

export async function readSchemaLedger(client) {
  const table = await client.query("SELECT to_regclass('public.schema_migrations') AS ledger");
  if (!table.rows[0]?.ledger) return null;
  const result = await client.query('SELECT filename FROM public.schema_migrations ORDER BY filename');
  return result.rows.map(row => row.filename);
}

export function assertKnownMigrations(applied, files) {
  const known = new Set(files);
  if (applied?.some(filename => !known.has(filename))) throw new Error('schema_version_not_supported');
}

/** Caller holds normal runtime admission while this short, read-only check runs. */
export async function verifyRuntimeSchemaReadiness({ database, environment = process.env }) {
  const files = requireMigrationFiles(createMigrationRunner({ env: environment }));
  const client = await database.pool.connect();
  const lease = createDatabaseClientLease(client, { operation: 'schema_readiness' });
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    const authority = await client.query(RUNTIME_AUTHORITY_SQL);
    lease.assertHealthy();
    const row = authority.rows[0];
    if (!row || !['direct_login', 'restricted', 'no_membership', 'no_database_create',
      'no_schema_create', 'no_ownership'].every(key => row[key] === true)) {
      throw new Error('runtime_schema_authority_not_restricted');
    }
    const applied = await readSchemaLedger(client);
    lease.assertHealthy();
    assertKnownMigrations(applied, files);
    const appliedSet = new Set(applied);
    if (!applied || files.some(filename => !appliedSet.has(filename))) {
      throw new Error('schema_maintenance_required');
    }
    await client.query('COMMIT');
    lease.assertHealthy();
    return { status: 'ready', total: applied.length };
  } finally {
    // Closing also rolls back a failed check; never return session state to the pool.
    lease.release(true);
  }
}
