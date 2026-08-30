/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_EVIDENCE_CARD_VERSION,
  normalizePolicyCandidateEvidenceCard,
} from './policyCandidateEvidenceCardPresentation'

export const POLICY_LIBRARY_EVIDENCE_PROFILE_VERSION =
  'policy.library_evidence_profile.v1'

const MAXIMUM_CANDIDATES = 3

function boundedString(value, maximumLength = 160) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximumLength ? normalized : null
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function score(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 100 ? number : null
}

function candidate(value) {
  const rank = positiveInteger(value?.rank)
  const libraryId = positiveInteger(value?.library_id)
  const libraryName = boundedString(value?.library_name)
  const policyScore = score(value?.policy_score)
  const scoreMargin = score(value?.score_margin)
  const evidenceCard = normalizePolicyCandidateEvidenceCard(value?.evidence_card)

  return rank && rank <= MAXIMUM_CANDIDATES && libraryId && libraryName &&
    policyScore !== null && scoreMargin !== null && evidenceCard
    ? {
      rank,
      library_id: libraryId,
      library_name: libraryName,
      policy_score: policyScore,
      score_margin: scoreMargin,
      evidence_card: {
        version: POLICY_CANDIDATE_EVIDENCE_CARD_VERSION,
        ...evidenceCard,
      },
    }
    : null
}

/**
 * Revalidates the server-owned evidence profile before rendering it. Unknown
 * fields, raw evidence, and malformed candidates never reach the UI.
 */
export function normalizePolicyLibraryEvidenceProfile(value) {
  if (value?.version !== POLICY_LIBRARY_EVIDENCE_PROFILE_VERSION) return null

  const seenRanks = new Set()
  const seenLibraries = new Set()
  const candidates = (Array.isArray(value?.candidates) ? value.candidates : [])
    .map(candidate)
    .filter((entry) => {
      if (!entry || seenRanks.has(entry.rank) || seenLibraries.has(entry.library_id)) return false
      seenRanks.add(entry.rank)
      seenLibraries.add(entry.library_id)
      return true
    })
    .sort((left, right) => left.rank - right.rank)

  if (candidates.length < 2 || candidates.length > MAXIMUM_CANDIDATES ||
      candidates.some((entry, index) => entry.rank !== index + 1) ||
      candidates.some((entry) => entry.score_margin !==
        Math.max(0, candidates[0].policy_score - entry.policy_score))) {
    return null
  }

  return {
    version: POLICY_LIBRARY_EVIDENCE_PROFILE_VERSION,
    candidates,
  }
}
