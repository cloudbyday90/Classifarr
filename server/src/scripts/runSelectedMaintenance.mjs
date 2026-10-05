/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile, lstat } from 'node:fs/promises';
import { readEmbeddedAccounts } from '../bootstrap/embeddedIdentityPolicy.mjs';
import { assertSelectedMaintenanceBoundary, selectedMaintenanceTimeout } from '../bootstrap/embeddedSelectedMaintenanceContract.mjs';

export async function runSelectedMaintenance({ environment = process.env,
  context = { uid: process.getuid?.(), gid: process.getgid?.(), platform: process.platform,
    cwd: process.cwd(), args: process.argv.slice(2) },
  accounts = async () => readEmbeddedAccounts(await readFile('/etc/passwd', 'utf8'), await readFile('/etc/group', 'utf8')),
  assertNoEnvFile = async () => {
    try { await lstat('/app/.env'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    throw new Error('selected_maintenance_env_file_refused');
  },
  loadSchema = () => import('./runDatabaseSchemaMaintenance.mjs'),
  loadRestore = () => import('./runDatabaseRestoreMaintenance.mjs'),
} = {}) {
  try {
    const operation = assertSelectedMaintenanceBoundary(environment, context, await accounts());
    await assertNoEnvFile();
    // Commands retain their own input validation, SQL admission and pool cleanup.
    if (operation === 'schema') return await (await loadSchema()).runSchemaMaintenanceCommand({ args: ['--apply'] });
    return await (await loadRestore()).runRestoreMaintenanceCommand({ args: ['--apply'] });
  } catch { return 1; }
}

if (import.meta.main) {
  let deadline;
  try {
    const timeout = selectedMaintenanceTimeout(process.argv[2]?.slice(2));
    // eslint-disable-next-line n/no-process-exit -- hard one-shot bound; connection loss retains durable restore quarantine
    deadline = setTimeout(() => process.exit(1), timeout); deadline.unref();
    process.exitCode = await runSelectedMaintenance();
  } catch { process.exitCode = 1; }
  finally { clearTimeout(deadline); }
}
