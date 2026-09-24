/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const rate = (numerator, denominator) => denominator ? Number((numerator / denominator).toFixed(6)) : null;
const outcomes = () => ({ leadingMatch: 0, noTrainingEvidence: 0, destinationWithoutTrainingEvidence: 0,
  anchorShortlistDisplacement: 0, profileShortlistDisplacement: 0, retrievalShortlistMiss: 0, shortlistedNotLeading: 0 });
const armMetrics = () => ({ noEvidence: 0, candidateHits: 0, leadingMatches: 0, leadingMismatches: 0,
  correctionOutcomes: outcomes() });

/** Strip private scorer content before accumulating; prompt rotation is not ranking. */
export function projectSourceDescriptionRanking(entry) {
  const eligibleIds = entry.investigationCandidates.filter(candidate => candidate.eligible > 0).map(candidate => candidate.id);
  const ids = entry.candidates.filter(candidate => candidate.eligible > 0).map(candidate => candidate.id);
  return { ids, eligibleIds, leader: eligibleIds.find(id => ids.includes(id)) ?? null,
    descriptionIds: entry.descriptionOnlyCandidateIds.filter(id => eligibleIds.includes(id)),
    profileIds: entry.unprotectedCandidateIds.filter(id => eligibleIds.includes(id)) };
}

export function createSourceDescriptionMetrics() {
  return { cases: 0, changedShortlists: 0, changedLeaders: 0, correctionCases: 0,
    baseline: armMetrics(), sourceAware: armMetrics(),
    candidateGains: 0, candidateRegressions: 0, leadingGains: 0, leadingRegressions: 0 };
}

// A disjoint observation of where the labeled destination was lost, not causal inference.
function correctionOutcome(result, destination) {
  if (result.leader === destination) return 'leadingMatch';
  if (!result.eligibleIds.length) return 'noTrainingEvidence';
  if (!result.eligibleIds.includes(destination)) return 'destinationWithoutTrainingEvidence';
  if (result.ids.includes(destination)) return 'shortlistedNotLeading';
  if (result.profileIds.includes(destination)) return 'anchorShortlistDisplacement';
  if (result.descriptionIds.includes(destination)) return 'profileShortlistDisplacement';
  return 'retrievalShortlistMiss';
}

/** Corrections arrive only after both arms have finished label-blind ranking. */
export function addSourceDescriptionMetrics(value, baseline, sourceAware, label) {
  value.cases++;
  value.changedShortlists += Number(JSON.stringify([...baseline.ids].sort()) !== JSON.stringify([...sourceAware.ids].sort()));
  value.changedLeaders += Number(baseline.leader !== sourceAware.leader);
  for (const [name, result] of [['baseline', baseline], ['sourceAware', sourceAware]]) {
    value[name].noEvidence += Number(result.leader === null);
    if (!label) continue;
    value[name].candidateHits += Number(result.ids.includes(label.libraryId));
    value[name].leadingMatches += Number(result.leader === label.libraryId);
    value[name].leadingMismatches += Number(result.leader !== null && result.leader !== label.libraryId);
    value[name].correctionOutcomes[correctionOutcome(result, label.libraryId)]++;
  }
  if (!label) return;
  value.correctionCases++;
  const a = baseline.ids.includes(label.libraryId), b = sourceAware.ids.includes(label.libraryId);
  value.candidateGains += Number(!a && b); value.candidateRegressions += Number(a && !b);
  value.leadingGains += Number(baseline.leader !== label.libraryId && sourceAware.leader === label.libraryId);
  value.leadingRegressions += Number(baseline.leader === label.libraryId && sourceAware.leader !== label.libraryId);
}

export function finishSourceDescriptionMetrics(value) {
  for (const arm of [value.baseline, value.sourceAware]) {
    arm.candidateRecallAt3 = rate(arm.candidateHits, value.correctionCases);
    arm.leadingProposalMismatchRate = rate(arm.leadingMismatches, arm.leadingMatches + arm.leadingMismatches);
    arm.labeledProposals = arm.leadingMatches + arm.leadingMismatches;
  }
  return value;
}
