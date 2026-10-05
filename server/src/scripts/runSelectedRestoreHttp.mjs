/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile, lstat } from 'node:fs/promises';
import { Socket } from 'node:net';
import { readEmbeddedAccounts } from '../bootstrap/embeddedIdentityPolicy.mjs';
import { assertSelectedRestoreHttpBoundary } from '../bootstrap/embeddedSelectedRestoreHttp.mjs';
import { inspectSelectedConfiguration } from '../bootstrap/selectedConfigurationFiles.mjs';
import { createRestoreHandoffClient } from '../services/restoreHandoffClient.mjs';

export async function runSelectedRestoreHttp({ environment = process.env,
  context = { uid: process.getuid?.(), gid: process.getgid?.(), platform: process.platform,
    cwd: process.cwd(), args: process.argv.slice(2) },
  accounts = async () => readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')),
  assertNoEnvFile = async () => {
    try { await lstat('/app/.env'); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    throw new Error('selected_restore_http_env_file_refused');
  },
  inspectConfiguration = inspectSelectedConfiguration,
  connect = () => new Socket({ fd: 3, readable: true, writable: true }),
  loadDatabase = () => import('../config/database.mjs'),
  loadRuntime = () => import('../bootstrap/selectedRestoreHttpRuntime.mjs'),
} = {}) {
  assertSelectedRestoreHttpBoundary(environment, context, await accounts());
  await assertNoEnvFile();
  environment.API_KEY_ENCRYPTION_KEY = await inspectConfiguration({ environment,
    identity: { uid: context.uid, gid: context.gid } });
  const handoff = createRestoreHandoffClient({ channel: connect() });
  try {
    const database = await loadDatabase();
    return await (await loadRuntime()).startSelectedRestoreHttpServer({ database, handoff, environment });
  } catch (error) { handoff.close(); throw error; }
}

if (import.meta.main) {
  try { await runSelectedRestoreHttp(); }
  catch {
    process.stderr.write('Protected restore HTTP startup refused.\n');
    // eslint-disable-next-line n/no-process-exit -- failed startup cannot retain auth/database connections
    process.exit(1);
  }
}
