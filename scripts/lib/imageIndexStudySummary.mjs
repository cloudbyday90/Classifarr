/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertImageIndexStudyReceipt } from '../../server/src/scripts/imageIndexStudyContract.mjs';
import { IMAGE_INDEX_RESULTS, imageIndexResultByte } from '../../server/src/utils/imageIndexResultProtocol.mjs';

export function formatImageIndexStudySummary(result) {
  if (result?.cleanup !== 'passed' || result.mode !== 'image-index' || result.budget !== result.study?.budget) throw new Error('image_index_study_summary_invalid');
  const study = result.study;
  assertImageIndexStudyReceipt(study, result.budget);
  const mib = value => value === null ? 'Unavailable' : (value / 1024 ** 2).toFixed(1);
  const lines = ['# Image-index repair capacity', '',
    'Measured execution outcomes; an incomplete repair is not a passing build.', '',
    `Budget: ${study.budget}; dimensions: 2,000; owned cleanup: passed.`, '',
    '## Sequential build observations', '',
    '| Scenario | Rows | Outcome | Seconds | Valid indexes | Container peak MiB | Worker peak MiB | PostgreSQL peak MiB | CPU p95 cores |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const row of study.cases) lines.push(`| ${row.name} | ${row.rows} | ${row.outcome} | ${(row.durationMs / 1000).toFixed(2)} | ${row.validIndexes}/3 | ${mib(row.containerPeakBytes)} | ${mib(row.workerPeakBytes)} | ${mib(row.postgresPeakBytes)} | ${row.containerCpuP95.toFixed(2)} |`);
  lines.push('', 'Raw container memory includes PostgreSQL, web/probe/worker processes and cache. Peaks are sampled; process RSS values overlap shared mappings and must not be added.', '',
    '## Capacity decisions', '', '| Scenario | Acknowledged workspace MiB | Worker result |', '| --- | ---: | --- |');
  for (const row of study.cases) lines.push(`| ${row.name} | ${row.workMemMiB ?? 'Not captured'} | ${IMAGE_INDEX_RESULTS[imageIndexResultByte({ code: row.exitCode, signal: row.signal })]} |`);
  lines.push('',
    '## Database wait observations', '', '| Scenario | Samples | Building | Writer wait | Lock wait | I/O wait |', '| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const row of study.cases) lines.push(`| ${row.name} | ${row.samples} | ${row.phases.building} | ${row.phases.writer_wait} | ${row.waits.Lock} | ${row.waits.IO} |`);
  lines.push('', 'Counts are polling observations, not exact durations. Zero observations do not prove a wait never occurred.', '',
    '## Recovery and limits', '',
    'The separate 1,000-row interruption produced an invalid index; the old claim was rejected after rotation. The recovery outcome is shown above. Synthetic row counts and identity sums were preserved; all children and observed DDL stopped.', '',
    'One sequential run per size; warm-cache order effects and synthetic vectors limit generalization. This does not measure recall, concurrent production throughput, automatic demand admission or queue dispatch. The image-capacity profile is a disposable 4 GiB/2 CPU/128 PID experiment, not a production deployment change.', '',
    'Next: investigate any incomplete build under controlled resource profiles before changing memory, deadlines or retry policy.', '');
  return lines.join('\n');
}
