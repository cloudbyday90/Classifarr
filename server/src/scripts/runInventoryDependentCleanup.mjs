/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runDependentCleanupMeasurements } from './inventoryDependentCleanup/assessment.mjs';

export function runInventoryDependentCleanup(options = {}) {
    return runLibraryScanRecoveryBenchmark({ ...options, measure: runDependentCleanupMeasurements });
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    runInventoryDependentCleanup().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
        .catch(() => { process.stderr.write('Dependent cleanup benchmark failed; production data was not changed.\n'); process.exitCode = 1; });
}
