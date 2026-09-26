/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validQualityEvidence } from './qualityEvidenceContract.mjs';
import { qualityHash, readQualityReferences } from './sourcePairQualityContract.mjs';
import { summarizeSourcePairQuality } from './sourcePairQualityMetrics.mjs';
import { QUALITY_LIMITS, validSourcePairQualityReport } from './sourcePairQualityReport.mjs';

export function reportQualityEvidence(evidence, protocol, reference = null) {
  if (!validQualityEvidence(evidence, protocol)) throw new Error('quality_observation_invalid');
  const references = readQualityReferences(reference, protocol);
  const cases = evidence.cases.map(row => ({ ...row, results: row.arms.map(arm => ({ ...arm, destinationId: arm.target })) }));
  const metrics = summarizeSourcePairQuality(cases, references, { hashedDestinations: true }), total = metrics.total;
  const status = !total.sampled ? 'no_eligible_cases' : !total.independent.labels ? 'insufficient_reference_labels'
    : references.provenance === 'synthetic_fixture.v1' ? 'synthetic_only' : total.independent.unpaired ? 'incomplete_evidence'
      : total.independent.labels < total.sampled ? 'partial_reference_coverage' : 'measured';
  const canonical = [protocol.id, evidence.observedAt,
    evidence.cases.map(row => [row.item, row.mediaType, row.correctionTarget,
      row.arms.map(arm => [arm.status, arm.target, arm.gap, arm.requestKey, arm.responseHash])]).sort(([a], [b]) => a.localeCompare(b)),
    evidence.requests.map(row => [row.key, row.digest, row.promptTokens, row.outputTokens, row.latencyMs]).sort(([a], [b]) => a.localeCompare(b))];
  const report = { version: 'source_pair_quality_report.v2', protocolId: protocol.id, cacheRevision: qualityHash(canonical), status,
    provenance: references.provenance, ...metrics, usage: { uniqueCachedResponses: evidence.requests.length,
      historicalPromptTokens: evidence.requests.reduce((sum, row) => sum + row.promptTokens, 0),
      historicalOutputTokens: evidence.requests.reduce((sum, row) => sum + row.outputTokens, 0),
      historicalLatencyMs: evidence.requests.reduce((sum, row) => sum + row.latencyMs, 0) }, limits: { ...QUALITY_LIMITS } };
  if (!validSourcePairQualityReport(report)) throw new Error('quality_result_invalid');
  return report;
}
