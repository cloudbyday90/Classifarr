/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runRepairLifecycleAssessment } from './libraryRepairAssessment/runner.mjs';

export function runLibraryRepairLifecycleAssessment(options = {}) {
    return runLibraryScanRecoveryBenchmark({ ...options, measure: runRepairLifecycleAssessment });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
    runLibraryRepairLifecycleAssessment().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
        .catch(() => { process.stderr.write('Library repair lifecycle assessment failed; production remains unchanged.\n'); process.exitCode = 1; });
}
