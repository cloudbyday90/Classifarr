/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInterface } from 'node:readline/promises';
import { createIngestionSafeguardRepair } from '../services/ingestionSafeguardRepair.mjs';

export async function runIngestionSafeguardRepairCommand({ args = process.argv.slice(2),
  loadDatabase = () => import('../config/database.mjs'), output = line => process.stdout.write(`${line}\n`),
  confirm = async () => {
    if (!process.stdin.isTTY) return false;
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try { return await input.question('Type REPAIR to back up and repair only these database safeguards: ') === 'REPAIR'; }
    finally { input.close(); }
  }, createService = createIngestionSafeguardRepair } = {}) {
  if (args.length !== 3 || !['--preview', '--apply'].includes(args[0]) || args[1] !== '--actor' || !/^[1-9]\d*$/.test(args[2])) {
    output('Usage: node src/scripts/runIngestionSafeguardRepair.mjs --preview|--apply --actor ADMIN_USER_ID');
    return args.length === 0 || args[0] === '--help' ? 0 : 2;
  }
  let database;
  try {
    database = await loadDatabase();
    const service = createService(database), actor = Number(args[2]);
    const plan = await service.preview(actor);
    output(JSON.stringify({ ...plan, token: undefined }));
    if (args[0] === '--preview' || plan.reason === 'not_needed') return 0;
    if (!plan.token) return 75;
    output('Database-wide operation. A private database backup is retained; import-table writes briefly pause. No library inventory or migration history will be changed.');
    if (!await confirm()) return 2;
    output(JSON.stringify(await service.apply(actor, { token: plan.token, confirm: true })));
    return 0;
  } catch {
    output('Repair was not confirmed. Inspect the current catalog and retained backup before making another request.');
    return 1;
  } finally {
    try { await database?.pool.end(); }
    catch { output('Database session cleanup could not be confirmed. Check current status before another request.'); }
  }
}
if (import.meta.main) process.exitCode = await runIngestionSafeguardRepairCommand();
