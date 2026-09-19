/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { representativeCoverageReady } from './inventoryRepresentativeCoverage.mjs';
import { rankRepresentativeCandidates } from './representativeCandidateComparison.mjs';

export function coverageBenchmarkDecision(model, doc, vector, dimensions) {
  const candidates = [...model.libraries].filter(([, profile]) => profile.mediaType === doc.type);
  if (candidates.length < 2) return { reason: 'insufficient_candidates' };
  if (candidates.some(([, profile]) => profile.coverage.status === 'waiting')) return { reason: 'incomplete_profiles' };
  if (candidates.some(([, profile]) => !representativeCoverageReady(profile.coverage))) return { reason: 'sparse_profiles' };
  const decision = rankRepresentativeCandidates(candidates.map(([, profile]) => profile), vector, dimensions);
  if (decision.reason !== 'selected') return decision;
  const id = candidates[decision.index][0];
  return { reason: 'selected', id, agreement: doc.libraryIds.includes(id) };
}

export function createCoverageMetrics() {
  return { evaluated: 0, compared: 0, placementAgreements: 0, placementDisagreements: 0, abstained: 0, reasons: {},
    pairedWithComplete: { bothCompared: 0, changedDestination: 0, gainedAgreement: 0, lostAgreement: 0,
      newAbstentions: 0, recoveredComparisons: 0, bothAbstained: 0 } };
}

export function recordCoverageDecision(metrics, decision, baseline) {
  metrics.evaluated++;
  const compared = decision.reason === 'selected', completeCompared = baseline.reason === 'selected';
  if (compared) {
    metrics.compared++;
    metrics[decision.agreement ? 'placementAgreements' : 'placementDisagreements']++;
  } else {
    metrics.abstained++;
    metrics.reasons[decision.reason] = (metrics.reasons[decision.reason] ?? 0) + 1;
  }
  const paired = metrics.pairedWithComplete;
  if (compared && completeCompared) {
    paired.bothCompared++;
    paired.changedDestination += Number(decision.id !== baseline.id);
    paired.gainedAgreement += Number(decision.agreement && !baseline.agreement);
    paired.lostAgreement += Number(!decision.agreement && baseline.agreement);
  } else paired[completeCompared ? 'newAbstentions' : compared ? 'recoveredComparisons' : 'bothAbstained']++;
}
