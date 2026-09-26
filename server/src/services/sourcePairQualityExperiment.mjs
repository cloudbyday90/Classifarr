/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareSourcePairQualityProtocol } from './sourcePairQualityProtocol.mjs';
import { readQualityReferences, qualityHash, qualityTarget } from './sourcePairQualityContract.mjs';
import { summarizeSourcePairQuality } from './sourcePairQualityMetrics.mjs';
import { evaluateSourceDescriptionPair } from './sourceDescriptionPairedEvaluation.mjs';
import { evaluateAutomaticPolicyReplay } from './automaticPolicyReplay.mjs';
import { replayCachedAdjudication } from './cachedAdjudicationReplay.mjs';
import { readAdjudicationBatch, adjudicationBatchDigest } from './cachedAdjudicationContract.mjs';
import { AUTOMATIC_SOURCE_PAIR_OPTIONS } from './automaticSourcePairCohort.mjs';
import { QUALITY_LIMITS } from './sourcePairQualityReport.mjs';

/** Fixed read-only experiment: no capture/client capabilities, and labels never enter preparation. */
export async function executeSourcePairQualityExperiment(snapshot, protocol = null, reference = null,
  { evaluateRetrieval = evaluateSourceDescriptionPair, evaluatePolicy = evaluateAutomaticPolicyReplay, replay = replayCachedAdjudication } = {}) {
  const prepared = prepareSourcePairQualityProtocol(snapshot, protocol);
  if (!protocol) {
    if (reference !== null) throw new Error('quality_protocol_required');
    return prepared.protocol;
  }
  const references = readQualityReferences(reference, protocol), arms = [], cases = [], used = new Set();
  const { source, identity } = snapshot.inputs;
  const retrieval = evaluateRetrieval(source, identity, AUTOMATIC_SOURCE_PAIR_OPTIONS,
    { fixedSampleKeys: prepared.fixedSampleKeys, onPreparedArm: arm => arms.push(arm) });
  if (retrieval.status === 'complete' && source.policies?.length) {
    await evaluatePolicy(source, arms, retrieval, { onOutcomes: async (outcomes, corrections) => {
      for (let offset = 0; offset < protocol.cases.length; offset += 25) {
        await replay(outcomes, corrections, { ...source, adjudicationSelectionOffset: offset }, { includeAllCases: true,
          onCase: (key, mediaType, results, correction, requestKeys) => {
            cases.push({ item: qualityHash(key), mediaType, results,
              correctionTarget: correction ? qualityTarget(mediaType, correction.libraryId) : null });
            for (const key of requestKeys) if (key !== null) used.add(key);
          } });
      }
    } });
  } else {
    for (const row of protocol.cases) cases.push({ ...row, results: [0, 1].map(() => ({ status: 'unavailable',
      gap: retrieval.status === 'cache_incomplete' ? 'evidence_unavailable' : 'not_adjudication' })), correctionTarget: null });
  }
  const expected = new Map(protocol.cases.map(row => [row.item, row.mediaType]));
  if (cases.length !== expected.size || cases.some(row => expected.get(row.item) !== row.mediaType || !expected.delete(row.item))) {
    throw new Error('quality_cases_mismatch');
  }
  const metrics = summarizeSourcePairQuality(cases, references);
  const batch = readAdjudicationBatch(source.adjudicationBatch, source.adjudicationConfig?.fingerprint);
  const records = batch?.records.filter(row => used.has(row.key)) ?? [];
  const status = !cases.length ? 'no_eligible_cases' : !metrics.total.independent.labels ? 'insufficient_reference_labels'
    : references.provenance === 'synthetic_fixture.v1' ? 'synthetic_only'
      : metrics.total.independent.unpaired ? 'incomplete_evidence'
        : metrics.total.independent.labels < cases.length ? 'partial_reference_coverage' : 'measured';
  return { version: 'source_pair_quality_report.v1', protocolId: protocol.id, cacheRevision: qualityHash(adjudicationBatchDigest(batch)),
    status, provenance: references.provenance, ...metrics,
    usage: { uniqueCachedResponses: records.length, historicalPromptTokens: records.reduce((sum, row) => sum + row.generated.promptTokens, 0),
      historicalOutputTokens: records.reduce((sum, row) => sum + row.generated.outputTokens, 0),
      historicalLatencyMs: records.reduce((sum, row) => sum + row.generated.latencyMs, 0) },
    limits: { ...QUALITY_LIMITS } };
}
