/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { livePurposeEvaluationFixture, purposeCohortInput } from './purposeOutcomeFixture.mjs';
import { policyEvaluationPayloadBytes } from '../../services/policyEvaluationCaptureContract.mjs';

export function purposePolicyContextFixture(row, count = 1) {
  const payload = structuredClone(livePurposeEvaluationFixture({ mediaType: row.source.media_type, tmdbId: row.source.tmdb_id,
    origin: row.supplement.payload.purposeEvidence.origin }).capture.payload);
  payload.capturedAt = row.supplement.payload.capturedAt;
  const candidate = payload.candidates[0], ranked = payload.ranked[0];
  // Distinct policies may share a destination. Only the original retained leader has independently frozen proof.
  payload.policyCount = count;
  payload.candidates = Array.from({ length: count }, (_, i) => ({ ...structuredClone(candidate), policyId: candidate.policyId + i,
    purposeEvidence: i === 0 ? structuredClone(candidate.purposeEvidence) : null }));
  payload.ranked = Array.from({ length: count }, (_, i) => ({ ...structuredClone(ranked), policyId: ranked.policyId + i, score: ranked.score - i }));
  return { classificationId: row.classification_id, version: 2, mediaType: row.source.media_type, identityKey: row.source.identity_key,
    observedMicros: String(BigInt(Date.parse(payload.capturedAt)) * 1000n),
    expiresMicros: String(BigInt(Date.parse(row.supplement.payload.expiresAt)) * 1000n), reasonId: 'complete', expiredAt: null,
    payloadBytes: policyEvaluationPayloadBytes(payload), payload };
}
export const purposePolicyContextInput = (rows, captures = rows.map(row => purposePolicyContextFixture(row))) => ({
  ...purposeCohortInput(rows), policyContextInputs: new Map(rows.map((row, index) => [row.classification_id, captures[index]])),
});
