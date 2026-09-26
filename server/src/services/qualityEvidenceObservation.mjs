/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { executeSourcePairQualityExperiment } from './sourcePairQualityExperiment.mjs';
import { qualityHash, qualityTarget } from './sourcePairQualityContract.mjs';
import { evaluationArmGap } from './evaluationCoverageGaps.mjs';
import { evaluationDestination, isCompletedEvaluationOutcome } from './mixedPolicyReplayOutcome.mjs';
import { validQualityEvidence } from './qualityEvidenceContract.mjs';

export async function collectQualityObservation(snapshot, protocol) {
  let observation;
  await executeSourcePairQualityExperiment(snapshot, protocol, null, { onEvidence: ({ cases, records }) => {
    const requests = records.map(({ key, generated }) => ({ key, digest: qualityHash([
      generated.response, generated.latencyMs, generated.promptTokens, generated.outputTokens,
      generated.outputLimitReached, generated.inputTruncation, generated.contextLimitSuspected]),
      promptTokens: generated.promptTokens, outputTokens: generated.outputTokens, latencyMs: generated.latencyMs }));
    const byKey = new Map(requests.map(row => [row.key, row]));
    observation = { version: 'quality_evidence.v1', protocolId: protocol.id, observedAt: new Date(snapshot.observedAt).toISOString(), requests,
      cases: cases.map(row => ({ item: row.item, mediaType: row.mediaType, correctionTarget: row.correctionTarget,
        arms: row.results.map((result, index) => ({ status: isCompletedEvaluationOutcome(result) || result.status === 'misses' ? result.status : 'unavailable',
          target: evaluationDestination(result) === null ? null : qualityTarget(row.mediaType, evaluationDestination(result)),
          gap: evaluationArmGap(result), requestKey: row.requestKeys?.[index] ?? null,
          responseHash: byKey.get(row.requestKeys?.[index])?.digest ?? null })) })) };
  } });
  if (!validQualityEvidence(observation, protocol)) throw new Error('quality_observation_invalid');
  return observation;
}
