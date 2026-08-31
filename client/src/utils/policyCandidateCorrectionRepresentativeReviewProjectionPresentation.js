/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const VERSION = 'policy.candidate_correction_representative_review_projection.v1'
const PURPOSE_ID = 'representative_historical_correction_review'
const STATUS_IDS = Object.freeze({
  CONFIGURATION_REQUIRED: 'configuration_required',
  PROJECTION_NOT_CREATED: 'projection_not_created',
  PROJECTION_AVAILABLE: 'projection_available',
})
const PERIOD_IDS = Object.freeze(['previous', 'current'])
const MARGIN_BAND_IDS = Object.freeze(['0_to_4', '5_to_14', '15_to_29', '30_or_more'])
const SELECTION_STATUS_IDS = Object.freeze([
  'confirmed_candidate',
  'changed_to_candidate',
  'changed_outside_candidates',
  'routed_not_applicable',
])
const EVIDENCE_SOURCE_IDS = Object.freeze([
  'item_identity',
  'declared_policy',
  'observed_library_profile',
  'similar_item_retrieval',
  'confirmed_outcomes',
])
const EVIDENCE_STATE_IDS = Object.freeze([
  'anchored',
  'supporting',
  'contextual',
  'conflicting',
  'unavailable',
])
const MAX_ITEM_COUNT = 160

const MARGIN_LABELS = Object.freeze({
  '0_to_4': '0–4 points',
  '5_to_14': '5–14 points',
  '15_to_29': '15–29 points',
  '30_or_more': '30+ points',
})
const SELECTION_LABELS = Object.freeze({
  confirmed_candidate: 'Confirmed leading candidate',
  changed_to_candidate: 'Changed to another candidate',
  changed_outside_candidates: 'Changed outside candidates',
  routed_not_applicable: 'Not applicable',
})
const PERIOD_LABELS = Object.freeze({ previous: 'Previous 28 days', current: 'Current 28 days' })
const EVIDENCE_LABELS = Object.freeze({
  item_identity: 'Item identity',
  declared_policy: 'Declared policy',
  observed_library_profile: 'Observed library profile',
  similar_item_retrieval: 'Similar-item retrieval',
  confirmed_outcomes: 'Confirmed outcomes',
  anchored: 'Anchored',
  supporting: 'Supporting',
  contextual: 'Contextual',
  conflicting: 'Conflicting',
  unavailable: 'Unavailable',
})

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function normalizeTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null
}

function normalizeEvidenceSourceStates(value) {
  if (!Array.isArray(value) || value.length !== EVIDENCE_SOURCE_IDS.length) return null
  const stateBySource = new Map()
  for (const entry of value) {
    const source = asPlainObject(entry)
    if (!source || !EVIDENCE_SOURCE_IDS.includes(source.sourceId) ||
        !EVIDENCE_STATE_IDS.includes(source.stateId) || stateBySource.has(source.sourceId)) {
      return null
    }
    stateBySource.set(source.sourceId, source.stateId)
  }
  if (stateBySource.size !== EVIDENCE_SOURCE_IDS.length) return null
  return Object.freeze(EVIDENCE_SOURCE_IDS.map(sourceId => Object.freeze({
    sourceId,
    stateId: stateBySource.get(sourceId),
  })))
}

function normalizeProjection(value) {
  const source = asPlainObject(value)
  const createdAt = normalizeTimestamp(source?.createdAt)
  const expiresAt = normalizeTimestamp(source?.expiresAt)
  const itemCount = Number(source?.itemCount)
  const samplePerStratum = Number(source?.samplePerStratum)
  const windows = Array.isArray(source?.windows) ? source.windows : null
  const items = Array.isArray(source?.items) ? source.items : null

  if (!source || !createdAt || !expiresAt || createdAt >= expiresAt ||
      !Number.isInteger(itemCount) || itemCount < 0 || itemCount > MAX_ITEM_COUNT ||
      samplePerStratum !== 5 || !windows || windows.length !== 2 || !items || items.length !== itemCount) {
    return null
  }

  const normalizedWindows = windows.map(window => {
    const candidate = asPlainObject(window)
    const startAt = normalizeTimestamp(candidate?.startAt)
    const endAt = normalizeTimestamp(candidate?.endAt)
    return candidate && PERIOD_IDS.includes(candidate.periodId) && startAt && endAt && startAt < endAt
      ? Object.freeze({ periodId: candidate.periodId, startAt, endAt })
      : null
  })
  if (normalizedWindows.some(window => window === null) ||
      normalizedWindows[0].periodId !== 'previous' || normalizedWindows[1].periodId !== 'current' ||
      normalizedWindows[0].endAt !== normalizedWindows[1].startAt) return null

  const normalizedItems = items.map(item => {
    const candidate = asPlainObject(item)
    const ordinal = Number(candidate?.ordinal)
    const evidenceSourceStates = normalizeEvidenceSourceStates(candidate?.evidenceSourceStates)
    if (!candidate || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > MAX_ITEM_COUNT ||
        !PERIOD_IDS.includes(candidate.periodId) || !MARGIN_BAND_IDS.includes(candidate.scoreMarginBandId) ||
        !SELECTION_STATUS_IDS.includes(candidate.selectionStatusId) || !evidenceSourceStates) {
      return null
    }
    return Object.freeze({
      ordinal,
      periodId: candidate.periodId,
      scoreMarginBandId: candidate.scoreMarginBandId,
      selectionStatusId: candidate.selectionStatusId,
      evidenceSourceStates,
    })
  })
  if (normalizedItems.some(item => item === null)) return null
  const orderedItems = normalizedItems.slice().sort((left, right) => left.ordinal - right.ordinal)
  if (orderedItems.some((item, index) => item.ordinal !== index + 1)) return null

  return Object.freeze({
    createdAt,
    expiresAt,
    samplePerStratum,
    itemCount,
    windows: Object.freeze(normalizedWindows),
    items: Object.freeze(orderedItems),
  })
}

/**
 * Retains only the fixed server-redacted evaluation projection. This normalizer
 * intentionally drops unknown response fields, including any accidental item,
 * library, destination, AI, provider, prompt, response, or RAG data.
 */
export function normalizePolicyCandidateCorrectionRepresentativeReviewProjection(value) {
  const source = asPlainObject(value)
  if (!source || source.version !== VERSION || source.purposeId !== PURPOSE_ID ||
      source.historicalRecordAccess !== false || !Object.values(STATUS_IDS).includes(source.statusId)) {
    return null
  }

  if (source.statusId === STATUS_IDS.CONFIGURATION_REQUIRED && source.projection === null) {
    return Object.freeze({ statusId: source.statusId, projection: null })
  }
  if (source.statusId === STATUS_IDS.PROJECTION_NOT_CREATED && source.projection === null) {
    return Object.freeze({ statusId: source.statusId, projection: null })
  }
  if (source.statusId !== STATUS_IDS.PROJECTION_AVAILABLE) return null

  const projection = normalizeProjection(source.projection)
  return projection ? Object.freeze({ statusId: source.statusId, projection }) : null
}

export function getPolicyCandidateCorrectionRepresentativeReviewProjectionPresentation(statusId) {
  if (statusId === STATUS_IDS.CONFIGURATION_REQUIRED) {
    return Object.freeze({
      heading: 'Safeguard acknowledgement is required',
      message: 'A redacted evaluation snapshot cannot be created until the fixed historic-review safeguards are acknowledged.',
      statusClass: 'text-amber-300',
    })
  }
  if (statusId === STATUS_IDS.PROJECTION_NOT_CREATED) {
    return Object.freeze({
      heading: 'No redacted evaluation snapshot yet',
      message: 'Create one snapshot to review representative policy signals. The server selects the sample; this does not change policy, AI, RAG, or routing.',
      statusClass: 'text-gray-300',
    })
  }
  if (statusId === STATUS_IDS.PROJECTION_AVAILABLE) {
    return Object.freeze({
      heading: 'Redacted evaluation snapshot ready',
      message: 'This is a fixed, read-only sample of policy-signal categories. It contains no media identity, library, destination, prompt, response, provider, or RAG text.',
      statusClass: 'text-green-400',
    })
  }
  return null
}

export function presentPolicyCandidateCorrectionRepresentativeReviewProjectionItem(item) {
  const normalized = asPlainObject(item)
  if (!normalized || !PERIOD_LABELS[normalized.periodId] || !MARGIN_LABELS[normalized.scoreMarginBandId] ||
      !SELECTION_LABELS[normalized.selectionStatusId] || !Array.isArray(normalized.evidenceSourceStates)) {
    return null
  }
  const evidence = normalized.evidenceSourceStates.map(entry => {
    const sourceLabel = EVIDENCE_LABELS[entry.sourceId]
    const stateLabel = EVIDENCE_LABELS[entry.stateId]
    return sourceLabel && stateLabel ? `${sourceLabel}: ${stateLabel}` : null
  })
  if (evidence.some(entry => entry === null)) return null
  return Object.freeze({
    ordinal: normalized.ordinal,
    periodLabel: PERIOD_LABELS[normalized.periodId],
    marginLabel: MARGIN_LABELS[normalized.scoreMarginBandId],
    selectionLabel: SELECTION_LABELS[normalized.selectionStatusId],
    evidenceLabel: evidence.join('; '),
  })
}
