/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ARCHIVE_TABLES } from './archiveTables.mjs';
import { CATALOG_TABLES } from './catalogContract.mjs';
import { gatewayError } from './errors.mjs';

/** An explicit new reader contract; never relax the legacy inference-only role. */
export async function checkCatalogReader(client) {
  const { safe } = (await client.query(`SELECT NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
    AND NOT EXISTS(SELECT 1 FROM pg_roles p WHERE p.oid<>r.oid AND pg_has_role(r.oid,p.oid,'MEMBER'))
    AND NOT has_database_privilege(current_user,current_database(),'CREATE')
    AND NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname=ANY($1) AND
      (n.nspowner=r.oid OR has_schema_privilege(current_user,n.oid,'CREATE') OR NOT has_schema_privilege(current_user,n.oid,'USAGE')))
    AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1) AND
      (c.relowner=r.oid OR has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES')
        OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES')))
    AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname=ANY($1) AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS safe
    FROM pg_roles r WHERE r.rolname=current_user`, [['ollama_gateway', 'gateway_archive', 'gateway_cleanup']])).rows[0];
  if (!safe) throw gatewayError('gateway_catalog_reader_unsafe');
  for (const table of [...ARCHIVE_TABLES.map(name => `ollama_gateway.${name}`), ...CATALOG_TABLES]) {
    if (!(await client.query('SELECT has_table_privilege(current_user,$1,\'SELECT\') AS allowed', [table])).rows[0].allowed) {
      throw gatewayError('gateway_catalog_reader_unsafe');
    }
  }
}
