/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertCompatibleWorkerEnvironment } from '../bootstrap/embeddedCompatibleWorkerBoundary.mjs';
import { runDatabaseProfilingMaintenance } from '../services/databaseProfilingMaintenance.mjs';

export async function runCompatibleProfilingMaintenance({ environment = process.env,
  context = { uid: process.getuid?.(), gid: process.getgid?.(), platform: process.platform,
    cwd: process.cwd(), args: process.argv.slice(2) },
  loadDatabase = () => import('../config/database.mjs'), run = runDatabaseProfilingMaintenance,
} = {}) {
  let database, code = 1;
  try {
    assertCompatibleWorkerEnvironment(environment, context);
    if (context.args.length !== 1 || context.args[0] !== '--assess') return 2;
    database = await loadDatabase();
    const result = await run({ database });
    code = { already_active: 0, installed: 10, deferred: 75 }[result?.status] ?? 1;
  } catch { code = 1; }
  finally {
    try { await database?.pool.end(); }
    catch { code = 1; }
  }
  return code;
}

if (import.meta.main) {
  // eslint-disable-next-line n/no-process-exit -- bounds connection, SQL and cleanup as one child lifetime
  const timer = setTimeout(() => process.exit(1), 20_000); timer.unref();
  try { process.exitCode = await runCompatibleProfilingMaintenance(); }
  finally { clearTimeout(timer); }
}
