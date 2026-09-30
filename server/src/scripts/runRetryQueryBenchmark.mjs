/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
// eslint-disable-next-line n/no-unpublished-import -- Offline development benchmark, never imported by the server.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runRetryQueryMeasurements } from './retryQueryBenchmark/runner.mjs';

// Reuse the existing disposable-container lifecycle; no CLI connection/credential overrides.
export function runRetryQueryBenchmark(options = {}) {
  return runLibraryScanRecoveryBenchmark({
    start: password => new PostgreSqlContainer('postgres:18.6-alpine')
      .withDatabase('scan_recovery_benchmark').withUsername('benchmark').withPassword(password)
      .withResourcesQuota({ memory: 1024*1024*1024, cpu: 2 }).start(),
    ...options, measure: runRetryQueryMeasurements,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runRetryQueryBenchmark().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch(() => { process.stderr.write('Retry query benchmark failed; application data and configuration were not changed.\n'); process.exitCode = 1; });
}
