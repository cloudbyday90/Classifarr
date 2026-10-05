/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SELECTED_DATABASE_SOCKET } from './embeddedSelectedDatabaseLayout.mjs';
import { requireSeparatedEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';

export const SELECTED_RESTORE_MAX_BYTES = 64 * 1024 * 1024;
export function selectedMaintenanceTimeout(operation) {
  if (operation === 'schema') return 900_000;
  if (operation === 'restore') return 180_000;
  throw new Error('selected_maintenance_operation_invalid');
}

export function selectedMaintenanceEnvironment() {
  // su-exec sets HOME from the selected passwd entry, even with a numeric UID.
  return { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/var/lib/postgresql', LANG: 'C.UTF-8', TZ: 'UTC',
    NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=512',
    LOG_LEVEL: 'silent', FILE_LOGGING_ENABLED: 'false', CLASSIFARR_RUNTIME_MODE: 'normal',
    CLASSIFARR_SCHEMA_MAINTENANCE: 'startup', POSTGRES_HOST: SELECTED_DATABASE_SOCKET,
    POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr', POSTGRES_USER: 'classifarr',
    POSTGRES_POOL_MAX: '1', POSTGRES_CONN_TIMEOUT_MS: '5000', POSTGRES_STATEMENT_TIMEOUT_MS: '5000',
    POSTGRES_CONNECT_RETRIES: '0', MIGRATIONS_DIR: '/app/database/migrations' };
}

/** Defense in depth before any database/service import; no authority from environment flags. */
export function assertSelectedMaintenanceBoundary(environment, context, accounts) {
  const expected = selectedMaintenanceEnvironment();
  const { database } = requireSeparatedEmbeddedAccounts(accounts);
  if (context.platform !== 'linux' || context.cwd !== '/app' || context.uid !== database.uid
    || context.gid !== database.gid || Object.keys(environment).length !== Object.keys(expected).length
    || Object.entries(expected).some(([key, value]) => environment[key] !== value)) {
    throw new Error('selected_maintenance_boundary_invalid');
  }
  if (context.args.length !== 1 || !['--schema', '--restore'].includes(context.args[0])) {
    throw new Error('selected_maintenance_operation_invalid');
  }
  return context.args[0].slice(2);
}
