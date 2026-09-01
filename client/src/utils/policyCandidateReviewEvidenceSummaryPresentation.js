/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const CANDIDATE_EVIDENCE_SUMMARIES = Object.freeze({
  corroborated: Object.freeze({
    label: 'Several checks support this destination',
    message: 'The policy and retained evidence point here. You still make the final choice because this item is in review.',
    tone: 'positive',
  }),
  counter_evidence_recommended: Object.freeze({
    label: 'This destination is plausible, but not proven',
    message: 'The policy or existing collection supports this choice, but there is not enough independent evidence to route it automatically.',
    tone: 'attention',
  }),
  evidence_conflict: Object.freeze({
    label: 'The available checks disagree',
    message: 'At least one retained check points away from this destination. Compare the alternatives before you choose.',
    tone: 'conflict',
  }),
  identity_anchor_incomplete: Object.freeze({
    label: 'The item identity needs a closer look',
    message: 'A stable item identifier was not retained, so the available evidence cannot safely distinguish this destination from the alternatives.',
    tone: 'attention',
  }),
  evidence_unavailable: Object.freeze({
    label: 'There is not enough retained evidence to recommend a route',
    message: 'Choose the destination yourself after comparing the available alternatives.',
    tone: 'attention',
  }),
})

const CONTRASTIVE_EVIDENCE_SUMMARIES = Object.freeze({
  identity_unverified: Object.freeze({
    label: 'The exact-item check was unavailable',
    message: 'Classifarr did not use title similarity as a substitute for a stable item identity.',
    tone: 'attention',
  }),
  retrieval_unavailable: Object.freeze({
    label: 'The exact-item check could not complete',
    message: 'This did not change the suggested destination or the routing decision.',
    tone: 'attention',
  }),
  leading_identity_match: Object.freeze({
    label: 'The exact-item check supports this destination',
    message: 'This item already appears only in this library’s current inventory. You still make the final choice.',
    tone: 'positive',
  }),
  alternative_identity_match: Object.freeze({
    label: 'The exact-item check points to another destination',
    message: 'Review the alternatives before choosing because another eligible library already contains this exact item.',
    tone: 'conflict',
  }),
  shared_identity_match: Object.freeze({
    label: 'The exact-item check cannot separate the choices',
    message: 'More than one eligible library already contains this exact item.',
    tone: 'attention',
  }),
  no_candidate_identity_match: Object.freeze({
    label: 'The exact-item check did not add evidence',
    message: 'None of the eligible libraries currently contains this exact item.',
    tone: 'attention',
  }),
})

/**
 * Converts already-normalized, fixed evidence identifiers into concise
 * operator copy. No server-provided prose, catalogue data, or model output is
 * accepted here.
 */
export function getPolicyCandidateReviewEvidenceSummaryPresentation(
  candidateEvidence,
  contrastiveEvidence,
  candidateAdjudication,
) {
  const candidateSummary = CANDIDATE_EVIDENCE_SUMMARIES[candidateEvidence?.status_id]
  const contrastiveSummary = CONTRASTIVE_EVIDENCE_SUMMARIES[contrastiveEvidence?.status_id]

  if (candidateSummary) {
    return {
      ...candidateSummary,
      sources: Array.isArray(candidateEvidence.sources) ? candidateEvidence.sources : [],
      contrastive: contrastiveSummary
        ? {
            ...contrastiveSummary,
            detail_label: contrastiveEvidence.label,
            detail_message: contrastiveEvidence.message,
          }
        : null,
      adjudication: candidateAdjudication || null,
    }
  }

  if (contrastiveSummary) {
    return {
      ...contrastiveSummary,
      sources: [],
      contrastive: {
        ...contrastiveSummary,
        detail_label: contrastiveEvidence.label,
        detail_message: contrastiveEvidence.message,
      },
      adjudication: candidateAdjudication || null,
    }
  }

  if (!candidateAdjudication) return null

  return {
    label: 'An AI comparison is available',
    message: 'AI compared the eligible destinations as advice only. You still make the final choice.',
    tone: 'attention',
    sources: [],
    contrastive: null,
    adjudication: candidateAdjudication,
  }
}
