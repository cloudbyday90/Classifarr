/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runResourceStudyCompose } from './resourceStudyCompose.mjs';
import { assertResourceStudyReceipt, assertResourceStudyStartupReceipt } from '../../server/src/scripts/resourceStudyProfiles.mjs';
import { summarizeBudgetEnforcement } from '../../server/src/scripts/resourceStudyBudget.mjs';
import { withResourceStudyImage } from './resourceStudyImage.mjs';

/** Sequential, fixed scenarios. No caller-selected limits, image, path or command. */
export async function runResourceBudgetComparison({ study = runResourceStudyCompose, withImage = withResourceStudyImage, random = randomBytes,
  report = message => process.stdout.write(`${message}\n`), save = (identity, result) => {
    const directory = resolve(import.meta.dirname, '../../.tmp/resource-study', identity);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(resolve(directory, 'result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  } } = {}) {
  const suffix = random(16).toString('hex');
  if (!/^[a-f0-9]{32}$/.test(suffix)) throw new Error('resource_budget_identity_invalid');
  const identity = `comparison-${suffix}`, scenarios = [];
  const imageId = await withImage(async candidateImageId => {
    if (!/^sha256:[a-f0-9]{64}$/.test(candidateImageId)) throw new Error('resource_study_image_invalid');
    for (const budget of ['baseline', 'bounded', 'stress']) {
      const result = await study({ mode: 'capacity', budget, candidateImageId });
      assertResourceStudyReceipt(result?.study, 'capacity', budget);
      assertResourceStudyStartupReceipt(result?.startup?.fresh, budget);
      assertResourceStudyStartupReceipt(result?.startup?.maintenance, budget);
      if (result.cleanup !== 'passed' || result.mode !== 'capacity' || result.budget !== budget ||
        result.imageId !== candidateImageId) {
        throw new Error('resource_budget_comparison_mismatch');
      }
      const run = result.study;
      if (run.backlog?.pending !== 0 || run.backlog?.failed !== 0 || run.backlog?.routing !== 0 ||
        run.backlog?.completed !== 1620 || !Number.isSafeInteger(run.counters?.evaluations) || run.counters.evaluations < 1 ||
        ![run.drainMs, run.metrics?.containerBytes?.max, run.metrics?.containerCores?.p95,
          run.metrics?.eventLoopP99Ms?.max, run.metrics?.pids?.max].every(value => Number.isFinite(value) && value >= 0)) {
        throw new Error('resource_budget_comparison_incomplete');
      }
      // Explicit aggregate fields only: never forward arbitrary per-item data into this report.
      scenarios.push({ budget, durationMs: run.durationMs, drainMs: run.drainMs,
        completed: run.backlog?.completed, evaluations: run.counters?.evaluations,
        firstDispatchMs: run.queueRecovery.firstDispatchMs, cohortCompletedMs: run.queueRecovery.completedMs,
        containerMemoryPeakBytes: run.metrics?.containerBytes?.max, containerCpuP95Cores: run.metrics?.containerCores?.p95,
        eventLoopP99MaxMs: run.metrics?.eventLoopP99Ms?.max, sampledPidsPeak: run.metrics?.pids?.max,
        enforcement: summarizeBudgetEnforcement(run.initial, run.final) });
    }
    return candidateImageId;
  });
  const result = { version: 'resource_budget_comparison.v1', status: 'passed', mode: 'capacity', imageId,
    imageCleanup: 'passed', scope: 'synthetic_services_not_production_defaults', scenarios };
  save(identity, result);
  report(`RESOURCE_BUDGET_RESULT .tmp/resource-study/${identity}/result.json`);
  return result;
}
