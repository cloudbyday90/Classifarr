/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertResourceStudyReceipt } from '../../server/src/scripts/resourceStudyProfiles.mjs';
import { formatImageIndexStudySummary } from './imageIndexStudySummary.mjs';

/** Only validated aggregates enter Markdown; no payloads or arbitrary text. */
export function formatResourceStudySummary(result) {
  if (result?.mode === 'image-index') return formatImageIndexStudySummary(result);
  if (result?.cleanup !== 'passed' || result.mode !== result.study?.profile || result.budget !== result.study?.budget) {
    throw new Error('resource_study_summary_invalid');
  }
  const study = result.study;
  assertResourceStudyReceipt(study, result.mode, result.budget);
  const mib = value => (value / 1024 ** 2).toFixed(2);
  const lines = ['# Mixed-workload resource observation', '',
    `Profile: **${result.mode}**; budget: **${result.budget}**; cgroup v${study.final.version}; owned cleanup: passed.`, '',
    `Effective PID limit: **${study.final.pidsLimit === -1 ? 'unlimited' : study.final.pidsLimit}**${result.budget === 'baseline' ? ' (host default; no application-requested PID cap)' : ' (explicit study ceiling)'}.`, '',
    result.mode === 'soak' ? '30-minute bounded workload plus settled idle observation; not a long-term leak certification.'
      : 'Short validation profile; not sustained-soak evidence.', '',
    '## Memory by observation window', '',
    'Early/late are window medians. Peaks are sampled, not instantaneous maxima. Slope is descriptive, not a leak verdict.', '',
    '| Phase | Scope | Early MiB | Late MiB | Change MiB | MiB/min slope | Sampled peak MiB |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |'];
  const labels = { rssBytes: 'Whole probe RSS', heapBytes: 'Main-thread heap', externalBytes: 'Main-thread external',
    arrayBufferBytes: 'Main-thread ArrayBuffers', containerBytes: 'Raw container memory' };
  for (const phase of ['steady', 'recovery', 'idle']) {
    for (const [key, label] of Object.entries(labels)) {
      const row = study.trend.phases[phase].memory[key];
      lines.push(`| ${phase} | ${label} | ${mib(row.earlyMedianBytes)} | ${mib(row.lateMedianBytes)} | ${mib(row.deltaBytes)} | ${mib(row.slopeBytesPerMinute)} | ${mib(row.sampledPeakBytes)} |`);
    }
  }
  lines.push('', 'ArrayBuffers are included in external memory; do not add them together. Container memory also includes PostgreSQL, the maintenance web process and cache.', '',
    '## Queue progress', '',
    `Unique items with local analysis and optional-provider evidence: **${study.uniqueCompleted}/${study.inventory}**. Bulk first-pass data is synthetic; only the eight-item retry cohort uses HTTP. Task completions below may include repeats. Providers remain configured through natural drain. Compare v6 runs only.`, '',
    '| Phase | Observed seconds | Samples | Peak pending | Oldest pending seconds | Completions during window | Completions/second |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const phase of ['steady', 'recovery', 'idle']) {
    const row = study.trend.phases[phase], backlog = row.backlog;
    lines.push(`| ${phase} | ${(row.spanMs / 1000).toFixed(1)} | ${row.samples} | ${backlog.peakPending} | ${backlog.oldestPendingSeconds.toFixed(2)} | ${backlog.completedDelta} | ${backlog.completionsPerSecond.toFixed(2)} |`);
  }
  lines.push('', `Held cohort: ${study.queueRecovery.completed}/${study.queueRecovery.cohortSize} completed; first dispatch ${(study.queueRecovery.firstDispatchMs / 1000).toFixed(2)} s after pressure cleared.`, '',
    '## Bounded provider recovery', '',
    'Real loopback HTTP and production retry persistence; no external provider traffic or forced retry deadlines. Quota-day reset and credential repair are explicit synthetic setup actions.', '',
    '| Unique completed | HTTP attempts | Auth / throttle / unavailable | Charged retries | Peak waiting | Waiting at finish |',
    '| ---: | ---: | --- | ---: | ---: | ---: |',
    `| ${study.providerRecovery.uniqueCompleted}/8 | ${study.providerRecovery.httpAttempts} | 1 / 1 / 1 | ${study.providerRecovery.chargedAttempts} | ${study.providerRecovery.peakPending} | ${study.providerRecovery.pending} |`, '',
    `Recovery after credential repair: ${(study.providerRecovery.recoveryMs / 1000).toFixed(2)} s. Shortest observed transient wait: ${(study.providerRecovery.transientMinWaitMs / 1000).toFixed(2)} s.`, '',
    `Unchanged waiting checks: ${study.providerRecovery.preservedWaitChecks}; pressure deferrals: ${study.providerRecovery.pressureDeferrals}; HTTP during pressure: ${study.providerRecovery.httpDuringPressure}. No retry work runs during settled idle.`, '',
    '## Next step', '',
    'Compare repeated matched runs. Investigate continued idle growth alongside heap/external memory and backlog before proposing live limits. No forced GC or process restart is used to reduce the measured footprint.', '',
    'Synthetic movie/TV services, not model accuracy or production capacity. Restart/scheduler recovery remains a separate installation drill.', '');
  return lines.join('\n');
}
