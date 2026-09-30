/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const STATE = '/rehearsal';
export const PG_DATA = '/rehearsal/postgres';
export const SOCKET = '/run/postgresql';
export const DATABASE = 'classifarr_isolation';
export const RESTORED_DATABASE = 'classifarr_isolation_restore';
export const RUNTIME_ROLE = 'cf_runtime';
export const ADMIN_ROLE = 'classifarr';

export function assertDrillEnvironment(environment, { uid, platform }) {
  if (environment.CLASSIFARR_EMBEDDED_ISOLATION_DRILL !== 'disposable-v1'
    || uid !== 0 || platform !== 'linux') throw new Error('disposable_root_container_required');
}

export function assertContainerLayout(mountinfo, interfaces) {
  const mounts = mountinfo.trim().split('\n').map(line => line.split(' '));
  const root = mounts.find(parts => parts[4] === '/');
  if (!root?.[5].split(',').includes('ro')
    || ![STATE, '/app/data', SOCKET].every(path => mounts.some(parts => parts[4] === path))
    || interfaces.some(name => name !== 'lo')) throw new Error('isolated_container_layout_required');
}

export function assertProbeEnvironment(environment, { uid, platform }, { admin = false, restored = false } = {}) {
  const expected = childEnvironment({ admin, restored });
  if (platform !== 'linux' || !Number.isInteger(uid) || uid <= 0
    || (admin ? uid === 1000 : uid !== 1000)
    || ['CLASSIFARR_EMBEDDED_ISOLATION_DRILL', 'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_DB',
      'POSTGRES_USER', 'CLASSIFARR_SCHEMA_MAINTENANCE', 'MIGRATIONS_DIR'].some(key => environment[key] !== expected[key])) {
    throw new Error('isolated_probe_environment_required');
  }
}

// Whitelist, not a copy of the supervisor's environment; no administrator secret.
export function childEnvironment({ admin = false, restored = false } = {}) {
  return {
    CLASSIFARR_EMBEDDED_ISOLATION_DRILL: 'disposable-v1',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    HOME: '/tmp', LANG: 'C.UTF-8', TZ: 'UTC', NODE_ENV: 'production',
    NODE_OPTIONS: '--max-old-space-size=1024',
    FILE_LOGGING_ENABLED: 'false', LOG_LEVEL: 'error',
    CLASSIFARR_SCHEMA_MAINTENANCE: admin ? 'startup' : 'external',
    POSTGRES_HOST: SOCKET, POSTGRES_PORT: '5432',
    POSTGRES_DB: restored ? RESTORED_DATABASE : DATABASE,
    POSTGRES_USER: admin ? ADMIN_ROLE : RUNTIME_ROLE,
    POSTGRES_POOL_MAX: '5', MIGRATIONS_DIR: '/app/database/migrations',
    PORT: '21324',
  };
}

export const HBA = `local all ${ADMIN_ROLE} peer map=maintenance
local ${DATABASE},${RESTORED_DATABASE} ${RUNTIME_ROLE} peer map=runtime
local all all reject
host all all 0.0.0.0/0 reject
host all all ::0/0 reject
`;
export const IDENT = `maintenance postgres ${ADMIN_ROLE}
runtime classifarr ${RUNTIME_ROLE}
`;
