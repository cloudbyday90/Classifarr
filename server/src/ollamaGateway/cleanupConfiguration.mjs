/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isAbsolute,resolve } from 'node:path';
import { gatewayArchiveConfiguration } from './archiveContract.mjs';
import { checkArchiveRole } from './archiveWorkerConfiguration.mjs';
import { gatewayError } from './errors.mjs';

export function cleanupConfiguration(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'archives,database,providerHash,receipts,retentionDays') {
    throw gatewayError('gateway_cleanup_config_invalid');
  }
  const source = gatewayArchiveConfiguration({ database: value.database,providerHash: value.providerHash,retentionDays: value.retentionDays });
  if (source.retentionDays < 90 || ![value.archives,value.receipts].every(path => typeof path === 'string' &&
      isAbsolute(path) && resolve(path) === path) || value.archives === value.receipts ||
      value.archives.startsWith(`${value.receipts}/`) || value.receipts.startsWith(`${value.archives}/`)) {
    throw gatewayError('gateway_cleanup_config_invalid');
  }
  return { ...source,archives: value.archives,receipts: value.receipts };
}

export async function checkCleanupRole(client) {
  await checkArchiveRole(client);
  const result = (await client.query(`SELECT
    pg_has_role(current_user,'classifarr_gateway_cleanup_owner','MEMBER')
    OR has_schema_privilege(current_user,'gateway_cleanup','CREATE')
    OR has_table_privilege(current_user,'gateway_cleanup.operation','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS unsafe,
    has_function_privilege(current_user,'gateway_cleanup.admit(uuid,text,text,text)','EXECUTE')
    AND has_function_privilege(current_user,'gateway_cleanup.execute_batch(uuid,integer)','EXECUTE')
    AND has_function_privilege(current_user,'gateway_cleanup.reconcile(uuid)','EXECUTE') AS permitted`)).rows[0];
  if (result.unsafe || !result.permitted) throw gatewayError('gateway_cleanup_role_unsafe');
  const owner = (await client.query(`SELECT rolcanlogin,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls
    FROM pg_roles WHERE rolname='classifarr_gateway_cleanup_owner'`)).rows[0];
  if (!owner || Object.values(owner).some(Boolean)) throw gatewayError('gateway_cleanup_role_unsafe');
}
