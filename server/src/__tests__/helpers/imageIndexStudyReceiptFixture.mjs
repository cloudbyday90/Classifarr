/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resourceStudyStartupFixture } from './resourceStudyReceiptFixture.mjs';
import { IMAGE_INDEX_STUDY_CASES, IMAGE_INDEX_STUDY_PHASES, IMAGE_INDEX_STUDY_WAITS } from '../../scripts/imageIndexStudyContract.mjs';

export function imageIndexStudyReceiptFixture(budget = 'baseline') {
  const metrics = resourceStudyStartupFixture(budget).metrics;
  return { version: 'image_index_study.v1', status: 'measured', profile: 'image-index', budget,
    dimensions: 2000, durationMs: 10000, rowsPreserved: true, workersStopped: true, databaseIdle: true,
    interruption: { invalidObserved: true, claimRotated: true, staleClaimRejected: true },
    initial: { ...metrics }, final: { ...metrics }, cases: IMAGE_INDEX_STUDY_CASES.map(scenario => ({
      ...scenario, outcome: 'complete', durationMs: 1000, validIndexes: 3, acknowledged: true,
      samples: 1, containerPeakBytes: 1024 ** 2, probePeakBytes: 1024, workerPeakBytes: null,
      postgresPeakBytes: null, containerCpuP95: 0.5, exitCode: 0, signal: null, watchdog: false,
      phases: Object.fromEntries(IMAGE_INDEX_STUDY_PHASES.map(key => [key, key === 'building' ? 1 : 0])),
      waits: Object.fromEntries(IMAGE_INDEX_STUDY_WAITS.map(key => [key, key === 'none' ? 1 : 0])),
    })) };
}
