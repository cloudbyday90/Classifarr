/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const INVENTORY_REFRESH_DISK_FULL = 'database_disk_full';
export const INVENTORY_REFRESH_STORAGE_RETRY_MS = 3_600_000;

const DATABASE_CODES = Object.freeze({
  '57014': 'database_query_cancelled', '55P03': 'database_lock_unavailable',
  '40P01': 'database_deadlock', '40001': 'database_serialization',
  '08000': 'database_connection', '08001': 'database_connection',
  '08003': 'database_connection', '08006': 'database_connection',
  '08007': 'database_connection', '08P01': 'database_connection',
  '53100': INVENTORY_REFRESH_DISK_FULL,
  '53300': 'database_capacity', '57P01': 'database_shutdown',
  '57P02': 'database_shutdown', '57P03': 'database_shutdown',
  '42501': 'database_permission', '42P01': 'database_schema', '42703': 'database_schema',
});
const DATABASE_PROBLEMS = Object.freeze({
  database_query_cancelled: 'PostgreSQL cancelled the operation. This code alone does not distinguish a statement timeout from another cancellation.',
  database_lock_unavailable: 'The database operation could not acquire its required lock.',
  database_deadlock: 'PostgreSQL detected a deadlock and cancelled the transaction.',
  database_serialization: 'The database transaction could not be serialized with concurrent work.',
  database_connection: 'The database connection or protocol failed.',
  database_disk_full: 'PostgreSQL reported insufficient storage for this operation.',
  database_capacity: 'PostgreSQL could not admit another connection.',
  database_shutdown: 'PostgreSQL was stopping, recovering, or not ready for a connection.',
  database_permission: 'The database rejected the operation for insufficient privileges.',
  database_schema: 'The database operation referenced an unavailable table or column.',
  database_unknown: 'A database operation failed without an allowlisted SQLSTATE.',
});
const DATABASE_STEPS = 'Keep completed cache entries and safeguards. If this persists, correlate this incident and time with PostgreSQL logs and database diagnostics. Do not reset imports or increase deadlines without evidence.';
export const INVENTORY_REFRESH_STORAGE_CHECKS = 'Check available space, inodes and quotas on the database, temporary-file and WAL volumes. Preserve backups, completed cache entries and database files.';
const STORAGE_STEPS = `${INVENTORY_REFRESH_STORAGE_CHECKS} Heavy refresh work retries automatically after one hour; this does not establish that storage has recovered.`;

/** Categorization only; callers must establish database origin at their operation boundary. */
export const inventoryRefreshSqlCategory = value => typeof value === 'string' && Object.hasOwn(DATABASE_CODES, value)
  ? DATABASE_CODES[value] : null;
export const isInventoryRefreshDatabaseCategory = value => typeof value === 'string' && Object.hasOwn(DATABASE_PROBLEMS, value);

export function inventoryRefreshDatabaseDiagnosis(category) {
  if (!isInventoryRefreshDatabaseCategory(category)) return null;
  return { code: category, phase: 'refresh', problem: DATABASE_PROBLEMS[category],
    steps: category === INVENTORY_REFRESH_DISK_FULL ? STORAGE_STEPS : DATABASE_STEPS,
    slowRetry: category === INVENTORY_REFRESH_DISK_FULL };
}
