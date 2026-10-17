/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError } from './errors.mjs';

/** Extra authority is not an acceptable fallback for incomplete optional provisioning. */
export async function checkCatalogMaintenanceRole(client) {
  const { safe } = (await client.query(`SELECT NOT (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
    AND NOT EXISTS(SELECT 1 FROM pg_roles p WHERE p.oid<>r.oid AND pg_has_role(r.oid,p.oid,'MEMBER'))
    AND NOT has_database_privilege(current_user,current_database(),'CREATE')
    AND NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname IN ('ollama_gateway','gateway_archive','gateway_catalog','gateway_cleanup')
      AND (n.nspowner=r.oid OR has_schema_privilege(current_user,n.oid,'CREATE')))
    AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('ollama_gateway','gateway_archive','gateway_catalog','gateway_cleanup') AND
      (c.relowner=r.oid OR has_table_privilege(current_user,c.oid,'DELETE,TRUNCATE,TRIGGER,REFERENCES')
        OR has_any_column_privilege(current_user,c.oid,'REFERENCES')
        OR n.nspname IN ('ollama_gateway','gateway_cleanup') AND
          (has_table_privilege(current_user,c.oid,'INSERT,UPDATE') OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE'))))
    AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('ollama_gateway','gateway_cleanup') AND has_function_privilege(current_user,p.oid,'EXECUTE')) AS safe
    FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
  const guards = (await client.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE
    tgrelid IN (to_regclass('gateway_catalog.job'),to_regclass('gateway_archive.job')) AND tgenabled='O'
    AND tgname IN ('catalog_job_guard','catalog_job_truncate','archive_catalog_guard','archive_catalog_admission','archive_catalog_truncate')`)).rows[0].n;
  if (!safe || guards !== 5) throw gatewayError('gateway_catalog_maintenance_unsafe');
}
