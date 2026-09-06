/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runSyncCompatibilityMeasurements } from './inventoryWriterCompatibility/syncAssessment.mjs';

export function runInventorySyncCompatibility(options = {}) {
    return runLibraryScanRecoveryBenchmark({ ...options, measure: runSyncCompatibilityMeasurements });
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    runInventorySyncCompatibility().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
        .catch(() => { process.stderr.write('Inventory sync compatibility benchmark failed; production sync was not changed.\n'); process.exitCode = 1; });
}
