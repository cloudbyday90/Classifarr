/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { assertResourceStudyReceipt, assertResourceStudyStartupReceipt } from '../../server/src/scripts/resourceStudyProfiles.mjs';
import { assertStudyBudgetContinuity, summarizeBudgetEnforcement } from '../../server/src/scripts/resourceStudyBudget.mjs';
import { STUDY_MEMORY_KEYS } from '../../server/src/scripts/resourceStudyTrend.mjs';
import { installationBudgetSnapshot } from '../../server/src/scripts/installationBudgetContract.mjs';

function numbers(row, keys, { signed = false } = {}) {
  return Object.fromEntries(keys.map(key => {
    const value = row?.[key];
    assert.ok(Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER && (signed || value >= 0));
    return [key, value];
  }));
}

// The v2 collector has no v1 under_oom field. Do not forward unused raw values.
const snapshot = metrics => installationBudgetSnapshot({ ...metrics,
  underOom: metrics?.version === 2 ? null : metrics?.underOom });

/** Revalidate scope and rebuild only fixed numeric aggregates, never raw study data. */
export function frozenResourceSoakEvidence(result, imageId) {
  assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result?.imageId, imageId);
  assert.equal(result.mode, 'soak');
  assert.equal(result.budget, 'bounded');
  assert.equal(result.cleanup, 'passed');
  const study = result.study;
  assertResourceStudyReceipt(study, 'soak', 'bounded');
  const counters = numbers(study.counters, ['evaluations', 'providerFailures', 'preservedOutages']);
  assert.ok(Object.values(counters).every(value => Number.isSafeInteger(value) && value > 0));
  for (const startup of [result.startup?.fresh, result.startup?.maintenance]) {
    assertResourceStudyStartupReceipt(startup, 'bounded');
  }
  assertStudyBudgetContinuity(result.startup.fresh.metrics, result.startup.maintenance.metrics, study.initial, study.final);
  const observations = {
    containerPeakBytes: study.metrics?.containerBytes?.max,
    containerCoresP95: study.metrics?.containerCores?.p95,
    eventLoopP99MaxMs: study.metrics?.eventLoopP99Ms?.max,
    pidsPeak: study.metrics?.pids?.max,
  };
  numbers(observations, ['containerPeakBytes', 'containerCoresP95', 'eventLoopP99MaxMs', 'pidsPeak']);
  assert.ok(observations.containerPeakBytes > 0 && observations.containerPeakBytes <= study.initial.limitBytes);
  assert.ok(Number.isSafeInteger(observations.pidsPeak) && observations.pidsPeak > 0 && observations.pidsPeak <= 128);
  const phases = Object.fromEntries(['steady', 'recovery', 'idle'].map(phase => {
    const row = study.trend.phases[phase];
    return [phase, { ...numbers(row, ['samples', 'spanMs', 'windowSamples']),
      memory: Object.fromEntries(STUDY_MEMORY_KEYS.map(key => [key, numbers(row.memory[key],
        ['earlyMedianBytes', 'lateMedianBytes', 'deltaBytes', 'sampledPeakBytes', 'slopeBytesPerMinute'], { signed: true })])),
      backlog: numbers(row.backlog, ['peakPending', 'oldestPendingSeconds', 'completedDelta', 'completionsPerSecond']) }];
  }));
  return { status: 'passed', mode: 'soak', budget: 'bounded', imageId, cleanup: 'passed', studyVersion: 'resource_study.v6',
    ...numbers(study, ['durationMs', 'requestedDurationMs', 'inventory', 'uniqueCompleted', 'evaluationRows', 'vectorDimensions', 'drainMs']),
    queueRecovery: numbers(study.queueRecovery,
      ['cohortSize', 'started', 'completed', 'startedDuringPressure', 'holdChecks', 'heldMs', 'firstDispatchMs', 'completedMs']),
    providerRecovery: numbers(study.providerRecovery,
      ['cohortSize', 'uniqueCompleted', 'pending', 'httpAttempts', 'chargedAttempts', 'preservedWaitChecks', 'pressureDeferrals',
        'transientMinWaitMs', 'recoveryMs', 'httpDuringPressure']),
    backlog: numbers(study.backlog, ['completed', 'pending', 'failed', 'routing']),
    trend: { version: 'resource_study_trend.v1', phases }, observations, counters,
    startup: { fresh: snapshot(result.startup.fresh.metrics), maintenance: snapshot(result.startup.maintenance.metrics) },
    initial: snapshot(study.initial), final: snapshot(study.final),
    enforcement: summarizeBudgetEnforcement(study.initial, study.final) };
}

export function formatFrozenSoakSummary(soak) {
  if (soak?.status !== 'passed') return 'Sustained resource soak: not verified.\n\n';
  return '## Same-image sustained resource soak\n\n' +
    '30-minute synthetic service workload plus two-minute settled idle; 2 CPUs / 2 GiB / 128 PIDs.\n\n' +
    '| Unique items | Pressure cohort | Provider cohort | Sampled container peak MiB | Sampled PID peak |\n' +
    '| ---: | ---: | ---: | ---: | ---: |\n' +
    `| ${soak.uniqueCompleted}/${soak.inventory} | ${soak.queueRecovery.completed}/20 | ${soak.providerRecovery.uniqueCompleted}/8 | ` +
    `${(soak.observations.containerPeakBytes / 1024 ** 2).toFixed(2)} | ${soak.observations.pidsPeak} |\n\n` +
    'Sampled observations, not instantaneous peaks, production capacity or a long-term leak verdict.\n\n';
}
