/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { normalizePolicyPurposeEvidence, policyPurposeEvidenceCopy } from './policyPurposeEvidencePresentation'
export const POLICY_CANDIDATE_EVIDENCE_CARD_VERSION = 'policy.candidate_evidence_card.v2'
const LEGACY_VERSION = 'policy.candidate_evidence_card.v1'

const STATUS_PRESENTATIONS = Object.freeze({
  corroborated: Object.freeze({
    label: 'Corroborating evidence is available',
    message: 'More than one retained evidence source supports the leading candidate. This remains a policy review, not an automatic route.',
    tone: 'positive',
  }),
  counter_evidence_recommended: Object.freeze({
    label: 'Separate corroboration is limited',
    message: 'Purpose and/or library context is available, but a retained cross-check from retrieval or confirmed outcomes is missing. Compare the purpose origin, item identity and alternatives before confirming.',
    tone: 'attention',
  }),
  evidence_conflict: Object.freeze({
    label: 'Conflicting evidence needs review',
    message: 'One or more deterministic signals conflict with the leading candidate. Review the item identity and alternatives before confirming; this card does not change routing.',
    tone: 'conflict',
  }),
  identity_anchor_incomplete: Object.freeze({
    label: 'Item identity needs review',
    message: 'A stable metadata identity was not retained for this decision. Treat title similarity as contextual and review alternatives before confirming.',
    tone: 'attention',
  }),
  evidence_unavailable: Object.freeze({
    label: 'Evidence details are incomplete',
    message: 'No retained deterministic support can establish the leading candidate beyond this pending policy decision. Review alternatives before confirming.',
    tone: 'attention',
  }),
})

const SOURCE_PRESENTATIONS = Object.freeze({
  item_identity: Object.freeze({
    label: 'Item identity anchor',
    states: Object.freeze({
      anchored: 'Media type and a stable metadata identifier are available.',
      unavailable: 'A stable metadata identifier was not retained.',
    }),
  }),
  declared_policy: Object.freeze({
    label: 'Purpose evidence',
    states: Object.freeze({
      supporting: 'A matched declared purpose has specialized supporting evidence.',
      contextual: 'Purpose evidence provides context and cannot establish this destination by itself.',
      conflicting: 'A deterministic policy constraint conflicts with the candidate.',
      unavailable: 'Verified purpose support is unavailable.',
    }),
  }),
  observed_library_profile: Object.freeze({
    label: 'Current library match',
    states: Object.freeze({
      contextual: 'This library’s existing items make it a reasonable option, but they cannot prove where this new item belongs.',
      conflicting: 'This library’s earlier placements point away from the candidate.',
      unavailable: 'No retained existing-library support is available.',
    }),
  }),
  similar_item_retrieval: Object.freeze({
    label: 'Similar-item retrieval',
    states: Object.freeze({
      supporting: 'A bounded similar-item retrieval signal supports the candidate.',
      unavailable: 'No retained similar-item retrieval support is available.',
    }),
  }),
  confirmed_outcomes: Object.freeze({
    label: 'Confirmed outcomes',
    states: Object.freeze({
      supporting: 'A confirmed pattern or prior confirmed outcome supports the candidate.',
      unavailable: 'No retained confirmed-outcome support is available.',
    }),
  }),
})

function boundedString(value, maximumLength = 80) {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized && normalized.length <= maximumLength ? normalized : null
}

function normalizeSource(value) {
  const sourceId = boundedString(value?.source_id)
  const stateId = boundedString(value?.state_id)
  const source = SOURCE_PRESENTATIONS[sourceId]
  const message = source?.states?.[stateId]

  return source && message
    ? { source_id: sourceId, state_id: stateId }
    : null
}

/**
 * Fails closed to a compact, allow-listed presentation. The server can only
 * communicate fixed source and state identifiers; metadata, retrieval text,
 * policy terms, and model output are deliberately not displayable here.
 */
export function normalizePolicyCandidateEvidenceCard(value) {
  if (![POLICY_CANDIDATE_EVIDENCE_CARD_VERSION, LEGACY_VERSION].includes(value?.version)) return null
  const purpose = value.version === LEGACY_VERSION ? null : normalizePolicyPurposeEvidence(value.purpose_evidence)
  if (value.version !== LEGACY_VERSION && !purpose) return null

  const statusId = boundedString(value?.status_id)
  const status = STATUS_PRESENTATIONS[statusId]
  if (!Array.isArray(value.sources) || value.sources.length !== 5) return null
  const seenSourceIds = new Set()
  const sources = (Array.isArray(value?.sources) ? value.sources : [])
    .map(normalizeSource)
    .filter((source) => {
      if (!source || seenSourceIds.has(source.source_id)) return false
      seenSourceIds.add(source.source_id)
      return true
    })
    .slice(0, 5)

  if (!status || sources.length !== 5) return null
  if (purpose?.origin === 'unverified' && sources.find(source => source.source_id === 'declared_policy')?.state_id !== 'unavailable') return null
  if (purpose && sources.find(source => source.source_id === 'declared_policy')?.state_id === 'supporting' &&
    (!['declared_native', 'mixed'].includes(purpose.origin) || purpose.declaredMatch !== 'matched' ||
      purpose.runtimeEligible !== true || purpose.specificity !== 'positive_specialized_evidence')) return null

  return { version: value.version, status_id: statusId, sources, ...(purpose ? { purpose_evidence: purpose } : {}) }
}

export function getPolicyCandidateEvidenceCardPresentation(value) {
  const card = normalizePolicyCandidateEvidenceCard(value)
  const status = STATUS_PRESENTATIONS[card?.status_id]
  if (!status) return null

  const sources = card.sources
    .map((source) => {
      const sourceDefinition = SOURCE_PRESENTATIONS[source.source_id]
      const message = sourceDefinition?.states?.[source.state_id]
      const purposeCopy = source.source_id === 'declared_policy'
        ? policyPurposeEvidenceCopy(card.purpose_evidence, card.version === LEGACY_VERSION)
        : null
      return sourceDefinition && message
        ? {
            id: source.source_id,
            label: purposeCopy?.label || sourceDefinition.label,
            message: purposeCopy
              ? `${purposeCopy.message}${source.state_id === 'conflicting' ? ' A deterministic policy constraint conflicts with this candidate.' : ''}`
              : message,
            state_id: source.state_id,
          }
        : null
    })
    .filter(Boolean)

  return sources.length === 5
    ? {
        ...card,
        label: status.label,
        message: status.message,
        tone: status.tone,
        sources,
      }
    : null
}
