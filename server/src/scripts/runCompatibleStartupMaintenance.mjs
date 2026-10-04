/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertCompatibleWorkerEnvironment } from '../bootstrap/embeddedCompatibleWorkerBoundary.mjs';
import { runDatabaseProfilingMaintenance } from '../services/databaseProfilingMaintenance.mjs';

export async function runCompatibleStartupMaintenance({ environment = process.env,
  context = { uid: process.getuid?.(), gid: process.getgid?.(), platform: process.platform,
    cwd: process.cwd(), args: process.argv.slice(2) },
  loadDatabase = () => import('../config/database.mjs'), run = runDatabaseProfilingMaintenance,
  loadSchema = () => import('../services/databaseSchemaMaintenance.mjs'),
} = {}) {
  let database, code = 1;
  try {
    assertCompatibleWorkerEnvironment(environment, context);
    if (context.args.length !== 1 || context.args[0] !== '--assess') return 2;
    database = await loadDatabase();
    const { runDatabaseSchemaMaintenance } = await loadSchema();
    const schema = await runDatabaseSchemaMaintenance({ database, environment: {} });
    if (schema?.status === 'deferred') code = 75;
    else if (schema?.status === 'complete') {
      const result = await run({ database });
      code = { already_active: 0, installed: 10, deferred: 20 }[result?.status] ?? 1;
    }
  } catch { code = 1; }
  finally {
    try { await database?.pool.end(); }
    catch { code = 1; }
  }
  return code;
}

if (import.meta.main) {
  // eslint-disable-next-line n/no-process-exit -- bounds connection, SQL and cleanup as one child lifetime
  const timer = setTimeout(() => process.exit(1), 900_000); timer.unref();
  try { process.exitCode = await runCompatibleStartupMaintenance(); }
  finally { clearTimeout(timer); }
}
