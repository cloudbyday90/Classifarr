/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION =
  'policy.candidate_contrastive_evidence.v1'

const PROVENANCE_ID = 'exact_tmdb_current_library_inventory'

const STATUS_PRESENTATIONS = Object.freeze({
  identity_unverified: Object.freeze({
    label: 'Cross-library identity check was not run',
    message: 'A stable TMDb identity was not retained, so this check did not fall back to title or similar-item matching.',
    tone: 'attention',
  }),
  retrieval_unavailable: Object.freeze({
    label: 'Cross-library identity check is unavailable',
    message: 'The bounded current-inventory check could not complete. No fallback or routing change was made.',
    tone: 'attention',
  }),
  leading_identity_match: Object.freeze({
    label: 'Current inventory supports the leading candidate',
    message: 'The exact stable item identity appears only in the leading candidate’s current inventory. This supports an existing association, not an automatic route.',
    tone: 'positive',
  }),
  alternative_identity_match: Object.freeze({
    label: 'Current inventory favors an alternative',
    message: 'The exact stable item identity appears in an alternative candidate’s current inventory, not the leading candidate. Treat this as counter-evidence and review the alternatives before confirming.',
    tone: 'conflict',
  }),
  shared_identity_match: Object.freeze({
    label: 'Current inventory cannot distinguish candidates',
    message: 'More than one viable candidate contains the same exact stable item identity, so current inventory is not decisive.',
    tone: 'attention',
  }),
  no_candidate_identity_match: Object.freeze({
    label: 'Current inventory provides no cross-check',
    message: 'No viable candidate currently contains this exact stable item identity. This is neutral evidence and does not change routing.',
    tone: 'attention',
  }),
})

function boundedString(value, maximumLength = 80) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximumLength ? normalized : null
}

/**
 * Accepts only the server's versioned, fixed result. It intentionally cannot
 * display catalog titles, identifiers, candidate IDs, raw retrieval content,
 * provider data, or model output.
 */
export function normalizePolicyCandidateContrastiveEvidence(value) {
  if (value?.version !== POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION) return null
  if (value?.provenance_id !== PROVENANCE_ID) return null

  const statusId = boundedString(value?.status_id)
  if (!STATUS_PRESENTATIONS[statusId]) return null

  return {
    version: POLICY_CANDIDATE_CONTRASTIVE_EVIDENCE_VERSION,
    provenance_id: PROVENANCE_ID,
    status_id: statusId,
  }
}

export function getPolicyCandidateContrastiveEvidencePresentation(value) {
  const evidence = normalizePolicyCandidateContrastiveEvidence(value)
  if (!evidence) return null

  const status = STATUS_PRESENTATIONS[evidence.status_id]
  return status
    ? { ...evidence, ...status }
    : null
}
