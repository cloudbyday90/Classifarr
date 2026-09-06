/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runPageRepairMeasurements } from './libraryPageRepair/runner.mjs';

export function runLibraryPageRepairPrototype(options = {}) {
    return runLibraryScanRecoveryBenchmark({ ...options, measure: runPageRepairMeasurements });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    runLibraryPageRepairPrototype().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
        .catch(() => { process.stderr.write('Library page repair prototype failed; production recovery remains unchanged.\n'); process.exitCode = 1; });
}
