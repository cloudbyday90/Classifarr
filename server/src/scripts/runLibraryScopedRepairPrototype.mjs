/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runScopedRepairMeasurements } from './libraryScopedRepair/runner.mjs';

export function runLibraryScopedRepairPrototype(options = {}) {
    return runLibraryScanRecoveryBenchmark({ ...options, measure: runScopedRepairMeasurements });
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    runLibraryScopedRepairPrototype().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
        .catch(() => { process.stderr.write('Library scoped repair benchmark failed; no production repair was enabled.\n'); process.exitCode = 1; });
}
