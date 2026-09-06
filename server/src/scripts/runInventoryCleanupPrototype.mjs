/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runInventoryCleanupMeasurements } from './inventoryCleanup/assessment.mjs';

export function runInventoryCleanupPrototype(options = {}) {
    return runLibraryScanRecoveryBenchmark({ ...options, measure: runInventoryCleanupMeasurements });
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    runInventoryCleanupPrototype().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
        .catch(() => { process.stderr.write('Inventory cleanup benchmark failed; production cleanup was not changed.\n'); process.exitCode = 1; });
}
