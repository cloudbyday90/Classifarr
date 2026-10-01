/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Rechecked by the trusted worker. An application-writable budget is not a security boundary. */
export async function assertQueueMaintenanceHandoffBoundary(database) {
  const client = await database.pool.connect();
  try {
    await client.query("SET statement_timeout = '3s'");
    const result = await client.query(`SELECT NOT (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole
      OR r.rolreplication OR r.rolbypassrls
      OR EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member = r.oid)
      OR has_schema_privilege(r.oid, 'public', 'CREATE')
      OR has_table_privilege(r.oid, 'public.queue_vacuum_recovery_state', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(r.oid, 'public.queue_vacuum_recovery_state', 'INSERT,UPDATE,REFERENCES')) AS safe
      FROM pg_catalog.pg_roles r WHERE r.rolname = 'cf_runtime'`);
    if (result.rows[0]?.safe !== true) throw new Error('queue_handoff_boundary_unavailable');
  } finally { client.release(true); }
}
