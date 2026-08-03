/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  adaptPolicyAuthoringLifecyclePresentation,
  POLICY_AUTHORING_LIFECYCLE_STATUS_IDS,
} from '@/utils/policyAuthoringLifecyclePresentation'
import {
  POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS,
  POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION,
} from '@/utils/policyAuthoringWorkflowPresentation'
import {
  normalizePolicyAuthoringProposalHelpfulStudioOptions,
  normalizePolicyAuthoringProposalPurposeGenreOptions,
} from '@/utils/policyAuthoringProposalAdjustment'

export const POLICY_AUTHORING_PROPOSAL_PRESENTATION_VERSION =
  'policy.authoring_proposal_presentation.v1'

export const POLICY_AUTHORING_PROPOSAL_PRESENTATION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
})

const SERVER_PROPOSAL_VERSION = 'policy.authoring_proposal.v1'
const SERVER_PREPARED_STATUS_ID = 'proposal_prepared'
const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{32,96}$/
const REVISION_PATTERN = /^[a-f0-9]{64}$/
const MAX_TITLE_LENGTH = 180
const MAX_RULE_FIELD_LENGTH = 80
const MAX_RULE_VALUE_LENGTH = 120
const MAX_RULE_VALUES = 5

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}
function hasOnlyKeys(value, expectedKeys) {
  const source = asObject(value)
  if (!source) return false

  const keys = Object.keys(source).sort()
  const allowedKeys = [...expectedKeys].sort()
  return keys.length === allowedKeys.length && keys.every((key, index) => key === allowedKeys[index])
}

function normalizeString(value, maximumLength) {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const normalized = String(value)
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)

  return normalized || null
}

function normalizeNonNegativeInteger(value) {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : null
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value

  Object.values(value).forEach(deepFreeze)
  return Object.freeze(value)
}

function normalizeDisplayRule(value) {
  if (!hasOnlyKeys(value, ['signalType', 'operator', 'values']) || !Array.isArray(value.values)) {
    return null
  }

  const signalType = normalizeString(value.signalType, MAX_RULE_FIELD_LENGTH)
  const operator = normalizeString(value.operator, MAX_RULE_FIELD_LENGTH)
  const values = value.values
    .map(ruleValue => normalizeString(ruleValue, MAX_RULE_VALUE_LENGTH))
    .filter(Boolean)

  if (!signalType || !operator || values.length !== value.values.length || values.length > MAX_RULE_VALUES) {
    return null
  }

  return { signalType, operator, values }
}

function normalizeDisplayRules(value) {
  if (!Array.isArray(value)) return null

  const rules = value.map(normalizeDisplayRule)
  return rules.every(Boolean) ? rules : null
}

function normalizeObservedContext(workflowPresentation, libraryId) {
  const source = asObject(workflowPresentation)
  const proposal = asObject(source?.destinationProposal)
  const context = asObject(proposal?.observedContext)

  if (
    source?.version !== POLICY_AUTHORING_WORKFLOW_PRESENTATION_VERSION ||
    source?.statusId !== POLICY_AUTHORING_WORKFLOW_PRESENTATION_STATUS_IDS.READY ||
    Number(source?.library?.id) !== libraryId ||
    !proposal ||
    !context ||
    typeof context.available !== 'boolean' ||
    typeof context.current !== 'boolean' ||
    !hasOnlyKeys(context, ['available', 'current', 'itemCount', 'suggestionCount'])
  ) {
    return deepFreeze({
      available: false,
      current: false,
      itemCount: null,
      suggestionCount: null,
      summary: 'Classifarr prepared this proposal from the current safe library profile.',
    })
  }

  const itemCount = context.itemCount === null
    ? null
    : normalizeNonNegativeInteger(context.itemCount)
  const suggestionCount = normalizeNonNegativeInteger(context.suggestionCount)
  const summary = normalizeString(proposal.summary, MAX_TITLE_LENGTH)
  if (
    (itemCount === null && context.itemCount !== null) ||
    suggestionCount === null ||
    !summary
  ) {
    return deepFreeze({
      available: false,
      current: false,
      itemCount: null,
      suggestionCount: null,
      summary: 'Classifarr prepared this proposal from the current safe library profile.',
    })
  }

  return deepFreeze({
    available: context.available,
    current: context.current,
    itemCount,
    suggestionCount,
    summary,
  })
}

function buildUnavailablePresentation(library) {
  return deepFreeze({
    version: POLICY_AUTHORING_PROPOSAL_PRESENTATION_VERSION,
    statusId: POLICY_AUTHORING_PROPOSAL_PRESENTATION_STATUS_IDS.UNAVAILABLE,
    library: library || null,
    title: null,
    purpose: [],
    helpfulHints: [],
    hardLimitCount: null,
    avoidCount: null,
    adjustment: Object.freeze({
      purposeGenres: Object.freeze([]),
      helpfulStudios: Object.freeze([]),
    }),
    observedContext: null,
  })
}

function normalizeAdjustmentPresentation(value) {
  if (!hasOnlyKeys(value, ['purposeGenres', 'helpfulStudios'])) return null

  const purposeGenres = normalizePolicyAuthoringProposalPurposeGenreOptions(value.purposeGenres)
  const helpfulStudios = normalizePolicyAuthoringProposalHelpfulStudioOptions(value.helpfulStudios)
  // Empty helpful-studio suggestions are valid. Any supplied option that does
  // not survive the strict option normalizer is an unsafe server payload.
  const hasValidOptionShapes = Array.isArray(value.purposeGenres) &&
    Array.isArray(value.helpfulStudios) &&
    purposeGenres.length === value.purposeGenres.length &&
    helpfulStudios.length === value.helpfulStudios.length

  return hasValidOptionShapes && purposeGenres.length > 0
    ? Object.freeze({ purposeGenres, helpfulStudios })
    : null
}

/**
 * Produces display-only proposal data and keeps opaque admission identifiers
 * separate so components cannot accidentally render or modify them.
 */
export function adaptPolicyAuthoringPreparedProposalPresentation({
  response,
  expectedLibrary,
  workflowPresentation = null,
} = {}) {
  const source = asObject(response)
  const lifecycleResult = adaptPolicyAuthoringLifecyclePresentation({
    lifecycle: source?.lifecycle,
    expectedLibrary,
  })

  if (
    source?.version !== SERVER_PROPOSAL_VERSION ||
    source?.statusId !== SERVER_PREPARED_STATUS_ID ||
    !hasOnlyKeys(source, ['version', 'statusId', 'lifecycle', 'proposal']) ||
    !lifecycleResult.ok ||
    lifecycleResult.presentation.statusId !==
      POLICY_AUTHORING_LIFECYCLE_STATUS_IDS.ELIGIBLE_TO_PREPARE_PROPOSAL ||
    !hasOnlyKeys(source.proposal, ['reference', 'revision', 'expiresAt', 'summary', 'adjustment']) ||
    !hasOnlyKeys(source.proposal.summary, [
      'title',
      'purpose',
      'helpfulHints',
      'hardLimitCount',
      'avoidCount',
    ])
  ) {
    return {
      ok: false,
      presentation: buildUnavailablePresentation(lifecycleResult.presentation?.library || null),
      admission: null,
    }
  }

  const reference = normalizeString(source.proposal.reference, 96)
  const revision = normalizeString(source.proposal.revision, 64)
  const expiresAt = typeof source.proposal.expiresAt === 'string' && Number.isFinite(Date.parse(source.proposal.expiresAt))
    ? new Date(source.proposal.expiresAt).toISOString()
    : null
  const title = normalizeString(source.proposal.summary.title, MAX_TITLE_LENGTH)
  const purpose = normalizeDisplayRules(source.proposal.summary.purpose)
  const helpfulHints = normalizeDisplayRules(source.proposal.summary.helpfulHints)
  const hardLimitCount = normalizeNonNegativeInteger(source.proposal.summary.hardLimitCount)
  const avoidCount = normalizeNonNegativeInteger(source.proposal.summary.avoidCount)
  const adjustment = normalizeAdjustmentPresentation(source.proposal.adjustment)

  if (
    !REFERENCE_PATTERN.test(reference || '') ||
    !REVISION_PATTERN.test(revision || '') ||
    !expiresAt ||
    !title ||
    !purpose ||
    !helpfulHints ||
    hardLimitCount === null ||
    avoidCount === null ||
    !adjustment
  ) {
    return {
      ok: false,
      presentation: buildUnavailablePresentation(lifecycleResult.presentation.library),
      admission: null,
    }
  }

  const library = lifecycleResult.presentation.library
  return {
    ok: true,
    presentation: deepFreeze({
      version: POLICY_AUTHORING_PROPOSAL_PRESENTATION_VERSION,
      statusId: POLICY_AUTHORING_PROPOSAL_PRESENTATION_STATUS_IDS.READY,
      library,
      title,
      purpose,
      helpfulHints,
      hardLimitCount,
      avoidCount,
      adjustment,
      observedContext: normalizeObservedContext(workflowPresentation, library.id),
    }),
    admission: deepFreeze({
      libraryId: library.id,
      reference,
      revision,
    }),
  }
}
