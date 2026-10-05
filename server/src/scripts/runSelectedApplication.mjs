/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile, lstat } from 'node:fs/promises';
import { readEmbeddedAccounts } from '../bootstrap/embeddedIdentityPolicy.mjs';
import { assertSelectedApplicationBoundary } from '../bootstrap/embeddedSelectedApplication.mjs';
import { inspectSelectedConfiguration } from '../bootstrap/selectedConfigurationFiles.mjs';

export async function runSelectedApplication({ environment = process.env,
  context = { uid: process.getuid?.(), gid: process.getgid?.(), platform: process.platform,
    cwd: process.cwd(), args: process.argv.slice(2) },
  accounts = async () => readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')),
  assertNoEnvFile = async () => {
    try { await lstat('/app/.env'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    throw new Error('selected_application_env_file_refused');
  },
  loadDatabase = () => import('../config/database.mjs'),
  loadApplication = () => import('../bootstrap/startApplication.mjs'),
  inspectConfiguration = inspectSelectedConfiguration,
  onAdmissionLost,
} = {}) {
  assertSelectedApplicationBoundary(environment, context, await accounts());
  if (typeof onAdmissionLost !== 'function') throw new Error('selected_application_fail_stop_required');
  await assertNoEnvFile();
  // Pin the validated key before any module can generate or fall back to a key.
  // It stays in this child's memory; no arguments, logs or new secret files.
  environment.API_KEY_ENCRYPTION_KEY = await inspectConfiguration({ environment,
    identity: { uid: context.uid, gid: context.gid } });
  const database = await loadDatabase();
  const { startApplication } = await loadApplication();
  return startApplication({ database, environment, onAdmissionLost });
}

if (import.meta.main) {
  const failStop = () => {
    process.stderr.write('Protected application refused startup or lost database admission.\n');
    // eslint-disable-next-line n/no-process-exit -- fail-stop imported workers rather than reconnect without admission
    process.exit(1);
  };
  try { await runSelectedApplication({ onAdmissionLost: failStop }); }
  catch { failStop(); }
}
