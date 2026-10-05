/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { SELECTED_DATABASE_DATA, SELECTED_DATABASE_SOCKET } from './embeddedSelectedDatabaseLayout.mjs';

export const SELECTED_MIGRATION_HBA = 'local all classifarr peer map=maintenance\nlocal classifarr cf_runtime peer map=runtime\nlocal all all reject\nhost all all 0.0.0.0/0 reject\nhost all all ::0/0 reject\n';
export const SELECTED_MIGRATION_IDENT = 'maintenance postgres classifarr\nruntime classifarr cf_runtime\n';
const fixed = Object.freeze({ data_directory: SELECTED_DATABASE_DATA,
  hba_file: '/app/data/embedded-postgres/pg_hba.conf', ident_file: '/app/data/embedded-postgres/pg_ident.conf',
  listen_addresses: '', unix_socket_directories: SELECTED_DATABASE_SOCKET, shared_preload_libraries: 'pg_stat_statements' });

/** A deliberately small grammar, not an approximate PostgreSQL configuration parser. */
export function verifySelectedMigrationPolicy({ config, hba, ident }) {
  if (hba !== SELECTED_MIGRATION_HBA || ident !== SELECTED_MIGRATION_IDENT || typeof config !== 'string') {
    throw new Error('selected_migration_policy_invalid');
  }
  const values = new Map();
  for (const line of config.trimEnd().split('\n')) {
    const match = /^([a-z_]+)=(?:'([^'\\\r\n]*)'|([0-9]+))$/.exec(line);
    if (!match || values.has(match[1])) throw new Error('selected_migration_policy_invalid');
    values.set(match[1], match[2] ?? match[3]);
  }
  if (values.size !== Object.keys(fixed).length + 2
    || Object.entries(fixed).some(([key, value]) => values.get(key) !== value)
    || !/^[1-9]\d{0,4}MB$/.test(values.get('shared_buffers') ?? '')
    || Number.parseInt(values.get('shared_buffers'), 10) > 65536
    || !/^[1-9]\d{0,3}$/.test(values.get('max_connections') ?? '')
    || Number(values.get('max_connections')) < 10 || Number(values.get('max_connections')) > 1000) {
    throw new Error('selected_migration_policy_invalid');
  }
}

export function validateSelectedSystemIdentifier(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value)
    || BigInt(value) > 18446744073709551615n) throw new Error('selected_migration_identity_invalid');
  return value;
}
