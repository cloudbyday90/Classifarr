/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const summarize = rows => {
  const complete = rows.filter(row => row.grounding);
  const ordinary = complete.filter(row => row.kind === 'ambiguous_nomination');
  const joint = ordinary.filter(row => row.status === 'supported' && row.grounding.controlStatus === 'supported');
  const sum = field => complete.reduce((total, row) => total + Number(row.grounding[field]), 0);
  return { completeCases: complete.length,
    repeatDecisionChanges: sum('repeatDecisionChanged'), reorderDecisionChanges: sum('reorderDecisionChanged'),
    repeatEvidenceChanges: sum('repeatEvidenceChanged'), reorderEvidenceChanges: sum('reorderEvidenceChanged'),
    candidateAssessments: sum('candidateAssessments'), insufficientAssessments: sum('insufficientAssessments'),
    contradictedAssessments: sum('contradictedAssessments'), supportedAssessments: sum('supportedAssessments'),
    abstentionReasons: Object.fromEntries(['multiple_supported', 'contradiction_without_support', 'insufficient_evidence']
      .map(reason => [reason, complete.filter(row => row.grounding.abstentionReason === reason).length])),
    controlStatuses: Object.fromEntries(['supported', 'abstained', 'order_sensitive']
      .map(status => [status, complete.filter(row => row.grounding.controlStatus === status).length])),
    pairedPlacement: { jointlyStableSelections: joint.length,
      gained: joint.filter(row => !row.grounding.controlAgrees && row.after).length,
      lost: joint.filter(row => row.grounding.controlAgrees && !row.after).length,
      controlStableAgreements: ordinary.filter(row => row.grounding.controlStatus === 'supported' && row.grounding.controlAgrees).length,
      groundedStableAgreements: ordinary.filter(row => row.status === 'supported' && row.after).length } };
};

export function buildGroundedComparisonReport(rows) {
  return { ...summarize(rows), byMedia: ['movie', 'tv'].map(mediaType => ({ mediaType,
    ...summarize(rows.filter(row => row.mediaType === mediaType)) })),
  referenceBindingIsEntailment: false, repeatabilityIsAccuracy: false,
  controlPasses: 2, groundedPasses: 3, groundedOutputTokens: { base: 32, perCandidate: 64 },
  reorderIncludesExampleOrder: true, reorderEffectIsCausalEstimate: false };
}
