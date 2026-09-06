/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assessDeletionSnapshot } from './inventoryDeletionPlan/snapshot.mjs';

export function runInventoryDeletionPlan(argv = process.argv.slice(2)) {
    if (!Array.isArray(argv) || argv.length) throw new Error('Deletion plan accepts no arguments');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Fixed repository snapshot URL; no caller path is accepted.
    return assessDeletionSnapshot(readFileSync(new URL('../../../database/schema/current.sql', import.meta.url), 'utf8'));
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    try { process.stdout.write(`${JSON.stringify(runInventoryDeletionPlan(), null, 2)}\n`); }
    catch { process.stderr.write('Inventory deletion plan failed; no data was changed.\n'); process.exitCode = 1; }
}
