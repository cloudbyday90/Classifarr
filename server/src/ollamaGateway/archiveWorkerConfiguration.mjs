/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isAbsolute, resolve } from 'node:path';
import { gatewayArchiveConfiguration } from './archiveContract.mjs';
import { gatewayError } from './errors.mjs';

export function archiveWorkerConfiguration(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'archives,maintenance,receipts,source') throw gatewayError('gateway_archive_config_invalid');
  const source = gatewayArchiveConfiguration(value.source);
  const maintenance = gatewayArchiveConfiguration({ ...source,database: value.maintenance }).database;
  if (!['host','database'].every(key => source.database[key] === maintenance[key]) ||
      (source.database.port ?? 5432) !== (maintenance.port ?? 5432) || source.database.user === maintenance.user ||
      ![value.archives,value.receipts].every(path => typeof path === 'string' && isAbsolute(path) && resolve(path) === path) ||
      value.archives === value.receipts || value.archives.startsWith(`${value.receipts}/`) || value.receipts.startsWith(`${value.archives}/`)) {
    throw gatewayError('gateway_archive_config_invalid');
  }
  return { source,maintenance,archives: value.archives,receipts: value.receipts };
}

export async function checkArchiveRole(client, source = false) {
  const role = (await client.query(`SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user`)).rows[0];
  const write = (await client.query(`SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='ollama_gateway' AND c.relkind='r' AND
    has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')) AS allowed`)).rows[0].allowed;
  if (Object.values(role).some(Boolean) || write) throw gatewayError('gateway_archive_role_unsafe');
  const elevated = (await client.query(`SELECT has_schema_privilege(current_user,'ollama_gateway','CREATE')
    OR has_database_privilege(current_user,current_database(),'CREATE')
    OR pg_has_role(current_user,'pg_execute_server_program','USAGE')
    OR pg_has_role(current_user,'pg_read_server_files','USAGE')
    OR pg_has_role(current_user,'pg_write_server_files','USAGE') AS allowed`)).rows[0].allowed;
  if (elevated) throw gatewayError('gateway_archive_role_unsafe');
  if (source && (await client.query(`SELECT has_schema_privilege(current_user,'gateway_archive','USAGE') AS allowed`)).rows[0].allowed) {
    throw gatewayError('gateway_archive_role_unsafe');
  }
}
