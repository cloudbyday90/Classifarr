/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedMaintenance } from './embeddedMaintenanceOutput.mjs';

const PROGRAMS = Object.freeze({
  schema: '/app/src/scripts/runDatabaseSchemaMaintenance.mjs',
  restore: '/app/src/scripts/runDatabaseRestoreMaintenance.mjs',
  indexes: '/app/src/scripts/runImageIndexMaintenance.mjs',
  vacuum: '/app/src/scripts/runQueueVacuumMaintenance.mjs',
  queueRecovery: '/app/src/scripts/runQueueRecoveryHandoff.mjs',
});

/** Trusted supervisor composition only. No command/path/env passthrough or HTTP caller. */
export function startEmbeddedMaintenance({ kind, identity, databaseName = 'classifarr', request = null,
  spawnFn = spawn, parentUid = process.getuid?.() }) {
  if (parentUid !== 0 || !Object.hasOwn(PROGRAMS, kind) || identity?.name !== 'postgres'
    || typeof databaseName !== 'string' || databaseName.trim() !== databaseName || !/^[a-z][a-z0-9_]{0,62}$/.test(databaseName)
    || (kind === 'restore' ? !Buffer.isBuffer(request) || request.length > 64 * 1024 * 1024 : request !== null)) {
    throw new Error('embedded_maintenance_launch_invalid');
  }
  const uid = parseEmbeddedId(identity.uid), gid = parseEmbeddedId(identity.gid);
  const child = spawnFn('/sbin/su-exec', [`${uid}:${gid}`, '/usr/local/bin/node', PROGRAMS[kind], kind === 'queueRecovery' ? '--assess' : '--apply'], {
    cwd: '/app', shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    // Do not inherit NODE_OPTIONS/preloads, PATH, PGOPTIONS, PGPASSFILE or any secrets.
    env: { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', LANG: 'C.UTF-8', TZ: 'UTC',
      NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=512',
      LOG_LEVEL: 'silent', FILE_LOGGING_ENABLED: 'false', POSTGRES_HOST: '/run/postgresql',
      POSTGRES_PORT: '5432', POSTGRES_DB: databaseName, POSTGRES_USER: 'classifarr',
      POSTGRES_POOL_MAX: '2', MIGRATIONS_DIR: '/app/database/migrations', CLASSIFARR_SCHEMA_MAINTENANCE: 'startup' },
  });
  return observeEmbeddedMaintenance(child, request);
}
