/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { assertImageIndexMixedReceipt } from '../../server/src/scripts/imageIndexMixedContract.mjs';

export function formatImageIndexMixedSummary(result) {
  if (result.cleanup !== 'passed' || !['image-index-mixed', 'classification-retrieval'].includes(result.mode)
    || result.mode !== result.study?.profile) throw new Error('image_mixed_summary_invalid');
  assertImageIndexMixedReceipt(result.study, result.budget);
  const lines = [result.mode === 'classification-retrieval' ? '# Classification retrieval during image-index repair' : '# Image-index mixed-load evidence', '',
    '50,000 synthetic vectors; 4 GiB / 2 CPUs / 128 PIDs. Real ingestion and metadata enrichment, synthetic providers and vector retrieval. No AI routing or accuracy claim.', '',
    '| Scenario | Build seconds | Database stop ms | Retrieval p95 ms | Scan p95 ms | Retrievals overlapping build | Container peak MiB |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const row of result.study.cases) lines.push(`| ${row.name} | ${row.execution ? (row.execution.durationMs / 1000).toFixed(2) : 'No build'} | ${row.execution?.databaseStopMs ?? 'N/A'} | ${row.foreground.retrievals.p95Ms.toFixed(2)} | ${row.foreground.scans.p95Ms.toFixed(2)} | ${row.overlapRetrievals} | ${(row.containerPeakBytes / 1024 ** 2).toFixed(1)} |`);
  if (result.mode === 'classification-retrieval') {
    lines.push('', 'Production text-first semantic SQL: 50 candidates, 5 results, 70% text / 30% image. All 200 result rows per phase retain image contributions and classification status. Plan profiling is separate from request latency.', '',
      '| Scenario | Text HNSW used | Image HNSW used | Sequential embedding scan | Plan execution ms | Shared read blocks |',
      '| --- | --- | --- | --- | ---: | ---: |');
    for (const row of result.study.cases) {
      const plan = row.foreground.semantic.plan;
      lines.push(`| ${row.name} | ${plan.textIndexUsed} | ${plan.imageIndexUsed} | ${plan.sequentialEmbeddingScan} | ${plan.executionMs.toFixed(2)} | ${plan.sharedReadBlocks} |`);
    }
  }
  lines.push('', 'Cancellation is intentionally incomplete; recovery must verify all three indexes. Original vectors and identities are preserved, stale claims rejected, children and observed DDL stopped, and owned resources cleaned.', '',
    'One sequential experiment, not a capacity SLA. Cache order, growing inventory and query plans affect comparison. Sampled overlap is not exact timing; raw container memory includes cache. No deliberate physical memory exhaustion.', '');
  return lines.join('\n');
}
