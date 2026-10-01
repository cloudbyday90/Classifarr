/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resourceStudyStartupFixture } from './resourceStudyReceiptFixture.mjs';
import { IMAGE_MIXED_CASES } from '../../scripts/imageIndexMixedContract.mjs';

export function imageIndexMixedReceiptFixture() {
  const metrics = resourceStudyStartupFixture('image-capacity').metrics;
  return { version: 'image_index_mixed.v1', status: 'measured', profile: 'image-index-mixed', budget: 'image-capacity',
    rows: 50000, durationMs: 50000, rowsPreserved: true, workersStopped: true, databaseIdle: true,
    invalidObserved: true, staleClaimRejected: true, initial: { ...metrics }, final: { ...metrics },
    cases: IMAGE_MIXED_CASES.map((name, i) => ({ name,
      foreground: { inventory: (i + 1) * 80, durationMs: 1000,
        scans: { count: 4, p50Ms: 1, p95Ms: 3, maxMs: 4 }, retrievals: { count: 40, p50Ms: 10, p95Ms: 30, maxMs: 40 } },
      containerPeakBytes: 1024, containerCpuP95: 1, startedDuringBuild: i > 0, overlapRetrievals: i ? 10 : 0,
      acknowledged: i === 1 || i === 3, workMemMiB: i === 1 || i === 3 ? 512 : null, validIndexes: i === 1 || i === 3 ? 3 : 0,
      execution: i === 0 ? null : { exitCode: i === 2 ? null : 0, signal: i === 2 ? 'SIGTERM' : null,
        interrupted: i === 2, watchdog: false, durationMs: 20000, databaseStopMs: 500 } })) };
}
