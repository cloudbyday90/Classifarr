/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runQueueRecoveryHandoff } from './runQueueRecoveryHandoff.mjs';
import { assertCompatibleWorkerEnvironment, assertCompatibleWorkerDatabase as assertCompatibleQueueDatabase } from '../bootstrap/embeddedCompatibleWorkerBoundary.mjs';
export { assertCompatibleQueueDatabase };

export function assertCompatibleQueueWorker(environment, { uid, gid, platform, cwd, args }) {
  assertCompatibleWorkerEnvironment(environment, { uid, gid, platform, cwd });
  if (args.length !== 1 || args[0] !== '--assess') {
    throw new Error('compatible_queue_worker_environment_invalid');
  }
}

export async function runCompatibleQueueRecovery({ environment = process.env,
  context = { uid: process.getuid?.(), gid: process.getgid?.(), platform: process.platform, cwd: process.cwd(), args: process.argv.slice(2) },
  run = runQueueRecoveryHandoff,
} = {}) {
  try { assertCompatibleQueueWorker(environment, context); }
  catch { return 2; }
  return run({ args: ['--assess'], assertBoundary: assertCompatibleQueueDatabase,
    startedMessage: 'Supervised queue recovery started after independent admission (shared identity)',
    unavailableMessage: 'Supervised queue maintenance unavailable; inspect embedded database health. Shared identity is unchanged.' });
}

if (import.meta.main) {
  // eslint-disable-next-line n/no-process-exit -- bounds connection, SQL, logging and cleanup as a single child lifetime
  const timer = setTimeout(() => process.exit(1), 85_000); timer.unref();
  try { process.exitCode = await runCompatibleQueueRecovery(); }
  finally { clearTimeout(timer); }
}
