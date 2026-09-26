/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validQualityEvidence } from './qualityEvidenceContract.mjs';
import { qualityHash } from './sourcePairQualityContract.mjs';

const completed = arm => ['automatic', 'proposed', 'abstained'].includes(arm.status);
const armDigest = arm => qualityHash([arm.status, arm.target, arm.gap, arm.requestKey, arm.responseHash]);
const requestDigest = row => qualityHash([row.key, row.digest, row.promptTokens, row.outputTokens, row.latencyMs]);
function mergeArm(previous, incoming) {
  if (previous.requestKey && incoming.requestKey && previous.requestKey !== incoming.requestKey ||
      previous.responseHash && incoming.responseHash && armDigest(previous) !== armDigest(incoming) ||
      completed(previous) && completed(incoming) && armDigest(previous) !== armDigest(incoming)) throw new Error('quality_evidence_conflict');
  return previous.responseHash || completed(previous) ? previous : incoming;
}

/** Stable successes/rejections survive eviction; conflicting exact-request evidence never wins by arrival order. */
export function mergeQualityEvidence(previous, incoming, protocol) {
  if (!validQualityEvidence(previous, protocol) || !validQualityEvidence(incoming, protocol)) throw new Error('quality_observation_invalid');
  if (Date.parse(incoming.observedAt) < Date.parse(previous.observedAt)) throw new Error('quality_observation_stale');
  const requests = new Map(previous.requests.map(row => [row.key, row]));
  for (const row of incoming.requests) {
    if (requests.has(row.key) && requestDigest(requests.get(row.key)) !== requestDigest(row)) throw new Error('quality_evidence_conflict');
    requests.set(row.key, row);
  }
  const old = new Map(previous.cases.map(row => [row.item, row]));
  const result = { ...incoming, requests: [...requests.values()].sort((a, b) => a.key.localeCompare(b.key)),
    cases: incoming.cases.map(row => {
      const prior = old.get(row.item);
      if (prior.correctionTarget && row.correctionTarget && prior.correctionTarget !== row.correctionTarget) throw new Error('quality_evidence_conflict');
      return { ...row, correctionTarget: prior.correctionTarget ?? row.correctionTarget,
        arms: row.arms.map((arm, index) => mergeArm(prior.arms[index], arm)) };
    }) };
  if (!validQualityEvidence(result, protocol)) throw new Error('quality_evidence_conflict');
  return result;
}
