/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
// eslint-disable-next-line n/no-unpublished-import -- Offline development benchmark, never imported by the server.
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runLibraryScanRecoveryBenchmark } from './runLibraryScanRecoveryBenchmark.mjs';
import { runRetryQueryMeasurements } from './retryQueryBenchmark/runner.mjs';
import { verifyDiagnosticContainerResources, assertDiagnosticContainerRemoved } from './diagnosticContainerResources.mjs';

// Reuse the existing disposable-container lifecycle; no CLI connection/credential overrides.
export async function runRetryQueryBenchmark(options = {}) {
  let ownedId, resources;
  try {
    const report = await runLibraryScanRecoveryBenchmark({
      start: async password => {
        const container = await new PostgreSqlContainer('postgres:18.6-alpine')
          .withDatabase('scan_recovery_benchmark').withUsername('benchmark').withPassword(password)
          // Testcontainers memory is GiB, not bytes. Verify Docker and kernel before SQL.
          .withResourcesQuota({ memory: 1, cpu: 2 }).start();
        ownedId = container.getId();
        try {
          resources = await verifyDiagnosticContainerResources(ownedId, { memoryGiB: 1, cpuCount: 2 });
          return container;
        } catch (error) { await container.stop(); throw error; }
      },
      ...options, measure: runRetryQueryMeasurements,
    });
    return { ...report, ...(resources ? { resources } : {}) };
  } finally { if (ownedId) await assertDiagnosticContainerRemoved(ownedId); }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runRetryQueryBenchmark().then(report => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch(() => { process.stderr.write('Retry query benchmark failed; application data and configuration were not changed.\n'); process.exitCode = 1; });
}
