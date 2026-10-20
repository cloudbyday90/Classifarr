/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import pg from 'pg';

/** New dedicated session each time; callers own connect/end, never a shared pool. */
export function archiveDatabaseClient(database,readOnly,applicationName) {
  return new pg.Client({ ...database,password:database.password ?? '',ssl:false,
    connectionTimeoutMillis:5000,statement_timeout:4000,query_timeout:5000,
    application_name:applicationName ?? (readOnly ? 'classifarr-gateway-archive-source' : 'classifarr-gateway-archive-coordinator'),
    options:readOnly ? '-c default_transaction_read_only=on' : undefined });
}
