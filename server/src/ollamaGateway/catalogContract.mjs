/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { archiveUuid, archiveHash } from './archiveRetentionContract.mjs';
import { gatewayError } from './errors.mjs';

// Versioned fixed identifiers, never names supplied by a manifest or caller.
export const CATALOG_TABLES = Object.freeze(['gateway_archive.job', 'gateway_archive.protection', 'gateway_cleanup.operation']);
export const CATALOG_ROW_LIMIT = 131072;
export const CATALOG_COUNTS = Object.freeze([10000, 1000, 1000]);
export const CATALOG_COLUMNS = Object.freeze([
  'id:uuid,ledger_id:uuid,provider_hash:text,policy_hash:text,revision:text,attempt:integer,status:text,created_at:timestamp with time zone,completed_at:timestamp with time zone,retry_after:timestamp with time zone,manifest_sha256:text,manifest:jsonb,receipt:jsonb,reason:text,recovery_protection_id:uuid',
  'id:uuid,capacity_slot:integer,ledger_id:uuid,provider_hash:text,candidates_sha256:text,first_archive_id:uuid,second_archive_id:uuid,first_manifest_sha256:text,second_manifest_sha256:text,minimum_recovery_days:integer,created_at:timestamp with time zone,ready_at:timestamp with time zone',
  'id:uuid,protection_id:uuid,ledger_id:uuid,provider_hash:text,candidates_sha256:text,attempt:integer,status:text,last_attempt_at:timestamp with time zone,retry_after:timestamp with time zone,completed_at:timestamp with time zone,completed_xid:xid8,confirmed_at:timestamp with time zone,deleted_bindings:integer,deleted_completions:integer,deleted_peers:integer',
]);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function validateCatalog(value) {
  if (!exact(value, ['version', 'tables', 'dependencies']) || value.version !== 1 ||
      !exact(value.tables, CATALOG_TABLES) || !CATALOG_TABLES.every((name, index) => {
        const item = value.tables[name];
        return exact(item, ['count', 'maxId', 'sha256']) && Number.isInteger(item.count) && item.count >= 0 &&
          item.count <= CATALOG_COUNTS[index] && (item.count ? archiveUuid(item.maxId) : item.maxId === null) && archiveHash(item.sha256);
      }) || !exact(value.dependencies, ['count', 'bytes', 'sha256']) ||
      !Number.isSafeInteger(value.dependencies.count) || value.dependencies.count < 0 || value.dependencies.count > 40000 ||
      !Number.isSafeInteger(value.dependencies.bytes) || value.dependencies.bytes < 0 || value.dependencies.bytes > 1073741824 ||
      !archiveHash(value.dependencies.sha256)) throw gatewayError('gateway_catalog_contract');
  return value;
}
