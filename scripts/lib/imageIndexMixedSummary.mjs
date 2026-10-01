/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertImageIndexMixedReceipt } from '../../server/src/scripts/imageIndexMixedContract.mjs';

export function formatImageIndexMixedSummary(result) {
  if (result.cleanup !== 'passed' || result.mode !== 'image-index-mixed') throw new Error('image_mixed_summary_invalid');
  assertImageIndexMixedReceipt(result.study, result.budget);
  const lines = ['# Image-index mixed-load evidence', '',
    '50,000 synthetic vectors; 4 GiB / 2 CPUs / 128 PIDs. Real ingestion and metadata enrichment, synthetic providers and vector retrieval. No AI routing or accuracy claim.', '',
    '| Scenario | Build seconds | Database stop ms | Retrieval p95 ms | Scan p95 ms | Retrievals overlapping build | Container peak MiB |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const row of result.study.cases) lines.push(`| ${row.name} | ${row.execution ? (row.execution.durationMs / 1000).toFixed(2) : 'No build'} | ${row.execution?.databaseStopMs ?? 'N/A'} | ${row.foreground.retrievals.p95Ms.toFixed(2)} | ${row.foreground.scans.p95Ms.toFixed(2)} | ${row.overlapRetrievals} | ${(row.containerPeakBytes / 1024 ** 2).toFixed(1)} |`);
  lines.push('', 'Cancellation is intentionally incomplete; recovery must verify all three indexes. Original vectors and identities are preserved, stale claims rejected, children and observed DDL stopped, and owned resources cleaned.', '',
    'One sequential experiment, not a capacity SLA. Cache order, growing inventory and query plans affect comparison. Sampled overlap is not exact timing; raw container memory includes cache. No deliberate physical memory exhaustion.', '');
  return lines.join('\n');
}
