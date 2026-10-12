/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertRefreshCycleRetention } from '../../server/src/scripts/comparisonMemoryStudy/cycleRetention.mjs';

export function formatComparisonCycleSummary(study) {
  assertRefreshCycleRetention(study.cycleRetention, study);
  const mib = value => (value / 1024 ** 2).toFixed(2);
  const points = [];
  for (const worker of ['comparison', 'representative']) {
    const rows = study.cycleRetention.completed.filter(row => row.worker === worker && row.completedAtMs > study.drainedAtMs);
    for (const [label, row] of [['first', rows[0]], ['last', rows.at(-1)]]) {
      points.push({ label: `${worker} ${label} (#${row.attempt})`, ...row });
    }
  }
  points.push({ label: 'stopped', ...study.cycleRetention.stopped });
  return '\n## Completed refresh reference points\n\n' +
    'First/last are successful post-drain refreshes, not peaks or leak verdicts. Main-thread heap and process-wide RSS have different scopes. Cache sizes are estimates, not heap measurements.\n\n' +
    '| Point | Main heap MiB | RSS MiB | Container MiB | Comparison cache MiB | Representative cache MiB | Active workers | Sampled live references |\n' +
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n' +
    points.map(({ label, memory, caches }) => `| ${label} | ${mib(memory.heapUsed)} | ${mib(memory.rss)} | ${mib(memory.containerBytes)} | ${mib(caches.comparison.estimatedBytes)} | ${mib(caches.representative.estimatedBytes)} | ${memory.activeWorkers} | ${Object.values(memory.alive).reduce((sum, n) => sum + n, 0)} |`).join('\n') +
    '\n\nCache inspection does not evict or renew entries. Weak references cover sampled objects only; survival before GC does not prove retention. Full per-cycle observations are in the JSON receipt.\n';
}
