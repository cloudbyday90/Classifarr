/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId, requireSeparatedEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';
import { SELECTED_DATABASE_SOCKET } from './embeddedSelectedDatabaseLayout.mjs';

export function selectedApplicationEnvironment() {
  return { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/home/classifarr', LANG: 'C.UTF-8', TZ: 'UTC',
    NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=1024',
    LOG_LEVEL: 'error', FILE_LOGGING_ENABLED: 'false', PORT: '21324',
    CLASSIFARR_RUNTIME_MODE: 'normal', CLASSIFARR_SCHEMA_MAINTENANCE: 'external',
    POSTGRES_HOST: SELECTED_DATABASE_SOCKET, POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr',
    POSTGRES_USER: 'cf_runtime', POSTGRES_POOL_MAX: '5', POSTGRES_CONNECT_RETRIES: '0',
    POSTGRES_CONN_TIMEOUT_MS: '5000', MIGRATIONS_DIR: '/app/database/migrations' };
}

export function assertSelectedApplicationBoundary(environment, context, accounts) {
  const { application } = requireSeparatedEmbeddedAccounts(accounts);
  const expected = selectedApplicationEnvironment();
  if (context.platform !== 'linux' || context.cwd !== '/app' || context.uid !== application.uid
    || context.gid !== application.gid || context.args.length !== 1 || context.args[0] !== '--run'
    || Object.keys(environment).length !== Object.keys(expected).length
    || Object.entries(expected).some(([key, value]) => environment[key] !== value)) {
    throw new Error('selected_application_boundary_invalid');
  }
}

/** Trusted composition has already verified selection and provisioned app directories. */
export function startSelectedApplication({ identity, spawnFn = spawn,
  uid = process.getuid?.(), platform = process.platform,
} = {}) {
  if (platform !== 'linux' || uid !== 0) throw new Error('selected_application_root_required');
  const target = `${parseEmbeddedId(identity?.uid)}:${parseEmbeddedId(identity?.gid)}`;
  return observeEmbeddedChild(spawnFn('/sbin/su-exec', [target, '/usr/local/bin/node',
    '/app/src/scripts/runSelectedApplication.mjs', '--run'], {
    cwd: '/app', shell: false, stdio: ['ignore', 'inherit', 'inherit'],
    env: selectedApplicationEnvironment(),
  }));
}
