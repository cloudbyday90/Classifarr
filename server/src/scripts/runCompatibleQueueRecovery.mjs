/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { runQueueRecoveryHandoff } from './runQueueRecoveryHandoff.mjs';

export function assertCompatibleQueueWorker(environment, { uid, gid, platform, cwd, args }) {
  if (platform !== 'linux' || !Number.isSafeInteger(uid) || uid <= 0 || !Number.isSafeInteger(gid) || gid <= 0
    || cwd !== '/app' || args.length !== 1 || args[0] !== '--assess'
    || environment.CLASSIFARR_RUNTIME_MODE !== 'normal' || environment.CLASSIFARR_SCHEMA_MAINTENANCE !== 'startup'
    || environment.POSTGRES_HOST !== 'localhost' || environment.POSTGRES_PORT !== '5432'
    || environment.POSTGRES_DB !== 'classifarr' || environment.POSTGRES_USER !== 'classifarr'
    || environment.CLASSIFARR_QUEUE_MAINTENANCE_CHANNEL !== undefined) {
    throw new Error('compatible_queue_worker_environment_invalid');
  }
}

/** Fixed local connection, not an isolated-role assertion or administrator fallback. */
export async function assertCompatibleQueueDatabase(database) {
  const client = await database.pool.connect();
  try {
    await client.query("SET statement_timeout = '3s'");
    const result = await client.query("SELECT current_user = 'classifarr' AND session_user = 'classifarr' AND current_database() = 'classifarr' AS compatible");
    if (result.rows[0]?.compatible !== true) throw new Error('compatible_queue_database_invalid');
  } finally { client.release(true); }
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
