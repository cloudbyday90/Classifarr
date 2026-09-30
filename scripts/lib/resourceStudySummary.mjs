/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertResourceStudyReceipt } from '../../server/src/scripts/resourceStudyProfiles.mjs';

/** Only validated aggregates enter Markdown; no payloads or arbitrary text. */
export function formatResourceStudySummary(result) {
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
    'Task completions include repeated attempts while synthetic OMDb demand is active; they are not unique items or successful provider responses. Exact synthetic providers are disabled before drain/idle. Compare v5 runs only.', '',
    '| Phase | Observed seconds | Samples | Peak pending | Oldest pending seconds | Completions during window | Completions/second |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const phase of ['steady', 'recovery', 'idle']) {
    const row = study.trend.phases[phase], backlog = row.backlog;
    lines.push(`| ${phase} | ${(row.spanMs / 1000).toFixed(1)} | ${row.samples} | ${backlog.peakPending} | ${backlog.oldestPendingSeconds.toFixed(2)} | ${backlog.completedDelta} | ${backlog.completionsPerSecond.toFixed(2)} |`);
  }
  lines.push('', `Held cohort: ${study.queueRecovery.completed}/${study.queueRecovery.cohortSize} completed; first dispatch ${(study.queueRecovery.firstDispatchMs / 1000).toFixed(2)} s after pressure cleared.`, '',
    '## Concurrent retry database exercises', '',
    '60 pending records preserved. Claims are rolled back, not provider requests or completed enrichments. Each pass includes dispatch discovery, a candidate page, and one claim/rollback.', '',
    '| Retry type | Before rotation passes | After rotation passes | Rolled-back claims | Recovered-wait claims | Longest type pass (ms) |',
    '| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const type of ['omdb', 'web_search', 'tavily']) {
    const row = study.retryLoad.types[type];
    lines.push(`| ${type} | ${row.beforePasses} | ${row.afterPasses} | ${row.rolledBackClaims} | ${row.recoveredClaims} | ${row.maxPassMs.toFixed(2)} |`);
  }
  lines.push('', `Retry co-load pressure deferrals: ${study.retryLoad.pressureDeferrals}; credential rotations: ${study.retryLoad.rotations}. No retry work runs during settled idle.`, '',
    '## Next step', '',
    'Compare repeated matched runs. Investigate continued idle growth alongside heap/external memory and backlog before proposing live limits. No forced GC or process restart is used to reduce the measured footprint.', '',
    'Synthetic movie/TV services, not model accuracy or production capacity. Restart/scheduler recovery remains a separate installation drill.', '');
  return lines.join('\n');
}
