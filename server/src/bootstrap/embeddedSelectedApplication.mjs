/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { spawn } from 'node:child_process';
import { parseEmbeddedId, requireSeparatedEmbeddedAccounts } from './embeddedIdentityPolicy.mjs';
import { observeEmbeddedChild } from './embeddedChildProcess.mjs';
import { SELECTED_DATABASE_SOCKET } from './embeddedSelectedDatabaseLayout.mjs';
import { selectedApplicationConfiguration, selectedConfigurationFromEnvironment } from './selectedApplicationConfiguration.mjs';

export function selectedApplicationEnvironment(configuration = {}) {
  return { PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/home/classifarr', LANG: 'C.UTF-8',
    NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=1024',
    CLASSIFARR_RUNTIME_MODE: 'normal', CLASSIFARR_SCHEMA_MAINTENANCE: 'external',
    POSTGRES_HOST: SELECTED_DATABASE_SOCKET, POSTGRES_PORT: '5432', POSTGRES_DB: 'classifarr',
    POSTGRES_USER: 'cf_runtime', POSTGRES_POOL_MAX: '5', POSTGRES_CONNECT_RETRIES: '0',
    POSTGRES_CONN_TIMEOUT_MS: '5000', MIGRATIONS_DIR: '/app/database/migrations',
    ...selectedApplicationConfiguration(configuration) };
}

export function assertSelectedApplicationBoundary(environment, context, accounts) {
  const { application } = requireSeparatedEmbeddedAccounts(accounts);
  const expected = selectedApplicationEnvironment(selectedConfigurationFromEnvironment(environment));
  if (context.platform !== 'linux' || context.cwd !== '/app' || context.uid !== application.uid
    || context.gid !== application.gid || context.args.length !== 1 || context.args[0] !== '--run'
    || Object.keys(environment).length !== Object.keys(expected).length
    || Object.entries(expected).some(([key, value]) => environment[key] !== value)) {
    throw new Error('selected_application_boundary_invalid');
  }
}

/** Trusted composition has already verified selection and provisioned app directories. */
export function startSelectedApplication({ identity, configuration = {}, spawnFn = spawn,
  uid = process.getuid?.(), platform = process.platform,
} = {}) {
  if (platform !== 'linux' || uid !== 0) throw new Error('selected_application_root_required');
  const target = `${parseEmbeddedId(identity?.uid)}:${parseEmbeddedId(identity?.gid)}`;
  return observeEmbeddedChild(spawnFn('/sbin/su-exec', [target, '/usr/local/bin/node',
    '/app/src/scripts/runSelectedApplication.mjs', '--run'], {
    cwd: '/app', shell: false, stdio: ['ignore', 'inherit', 'inherit'],
    env: selectedApplicationEnvironment(configuration),
  }));
}
