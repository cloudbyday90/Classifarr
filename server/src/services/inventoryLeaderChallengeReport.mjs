/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const counts = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(item => item === value).length]));

/** Never serialize per-item decisions, destination IDs, titles, learned terms or provider data. */
export function summarizeLeaderChallenges(rows) {
  const compared = rows.filter(row => row.assessment.policyLeaderId !== null);
  const changed = compared.filter(row => row.assessment.statusId === 'challenger');
  const baselineMatches = row => row.observed.includes(row.assessment.policyLeaderId);
  const challengerMatches = row => row.observed.includes(row.assessment.challengerId ?? row.assessment.policyLeaderId);
  const blocked = compared.filter(row => row.assessment.statusId === 'review_veto');
  const blockedChallenges = blocked.filter(row => row.assessment.blockedContent?.statusId === 'challenger');
  const blockedMatches = row => row.observed.includes(row.assessment.blockedContent.challengerId);
  return { sampled: rows.length, compared: compared.length, challenged: changed.length,
    statuses: counts(rows.map(row => row.assessment.statusId)), poolSizes: counts(rows.map(row => row.assessment.poolSize)),
    baselinePlacementAgreements: compared.filter(baselineMatches).length,
    challengedPlacementAgreements: compared.filter(challengerMatches).length,
    gained: changed.filter(row => !baselineMatches(row) && challengerMatches(row)).length,
    lost: changed.filter(row => baselineMatches(row) && !challengerMatches(row)).length,
    changedWithoutAgreement: changed.filter(row => !baselineMatches(row) && !challengerMatches(row)).length,
    observedOutsidePool: compared.filter(row => !row.observed.some(id => row.assessment.candidateOrder.includes(id))).length,
    heldWithRetainedHistory: rows.filter(row => row.retainedHistory).length,
    vetoDiagnostics: { blocked: blocked.length, reasons: counts(blocked.map(row => row.assessment.reviewReason)),
      contentStatuses: counts(blocked.map(row => row.assessment.blockedContent.statusId)),
      hypotheticalChallenges: blockedChallenges.length,
      hypotheticalGained: blockedChallenges.filter(row => !baselineMatches(row) && blockedMatches(row)).length,
      hypotheticalLost: blockedChallenges.filter(row => baselineMatches(row) && !blockedMatches(row)).length,
      hypotheticalNeither: blockedChallenges.filter(row => !baselineMatches(row) && !blockedMatches(row)).length,
      applied: 0 } };
}

export function buildLeaderChallengeReport(rows, libraries) {
  return { ...summarizeLeaderChallenges(rows),
    byMedia: ['movie', 'tv'].map(mediaType => ({ mediaType, ...summarizeLeaderChallenges(rows.filter(row => row.mediaType === mediaType)) })),
    byLibrary: [...libraries].sort((a, b) => a.id - b.id).map((library, index) => ({ stratum: index + 1, mediaType: library.media_type,
      ...summarizeLeaderChallenges(rows.filter(row => row.observed.includes(library.id))) })) };
}
