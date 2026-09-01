/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_EVIDENCE_CARD_VERSION =
  'policy.candidate_evidence_card.v1'

const STATUS_PRESENTATIONS = Object.freeze({
  corroborated: Object.freeze({
    label: 'Corroborating evidence is available',
    message: 'More than one retained evidence source supports the leading candidate. This remains a policy review, not an automatic route.',
    tone: 'positive',
  }),
  counter_evidence_recommended: Object.freeze({
    label: 'Separate corroboration is limited',
    message: 'The leading candidate has declared-policy and/or library-context support, but no retained cross-check from retrieval or confirmed outcomes. Library contents can reflect earlier placements, so compare the item identity and alternatives before confirming.',
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
    label: 'Declared policy',
    states: Object.freeze({
      supporting: 'A specialized or eligible declared policy signal supports the candidate.',
      contextual: 'Declared policy evidence is broad or overlapping and cannot establish the candidate by itself.',
      conflicting: 'A declared policy constraint conflicts with the candidate.',
      unavailable: 'No retained declared-policy support is available.',
    }),
  }),
  observed_library_profile: Object.freeze({
    label: 'Existing library fit',
    states: Object.freeze({
      contextual: 'Titles already in this library make it a plausible fit, but they do not prove this item belongs here.',
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
  if (value?.version !== POLICY_CANDIDATE_EVIDENCE_CARD_VERSION) return null

  const statusId = boundedString(value?.status_id)
  const status = STATUS_PRESENTATIONS[statusId]
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

  return { status_id: statusId, sources }
}

export function getPolicyCandidateEvidenceCardPresentation(value) {
  const card = value && typeof value === 'object' && value.status_id && Array.isArray(value.sources)
    ? value
    : normalizePolicyCandidateEvidenceCard(value)
  const status = STATUS_PRESENTATIONS[card?.status_id]
  if (!status) return null

  const sources = card.sources
    .map((source) => {
      const sourceDefinition = SOURCE_PRESENTATIONS[source.source_id]
      const message = sourceDefinition?.states?.[source.state_id]
      return sourceDefinition && message
        ? {
            id: source.source_id,
            label: sourceDefinition.label,
            message,
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
