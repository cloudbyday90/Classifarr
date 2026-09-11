/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  normalizeNativeIntentPurposeProvenance,
} from './policyNativeIntentPurposeProvenance'

const VERSION = 'policy_purpose_proposal_batch.v1'
const STATUS_IDS = new Set([
  'ready_for_apply',
  'no_compatible_proposals',
  'individual_review_required',
  'review_window_truncated',
])
const ACTION_ID = 'apply_reviewed_purpose_proposals'
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u

function hasOnlyKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function nonNegativeInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeEntry(value) {
  if (!hasOnlyKeys(value, ['policy', 'library', 'purposeProvenance'])) return null
  const policyId = positiveInteger(value.policy?.id)
  const policyName = nonEmptyString(value.policy?.name)
  const libraryId = positiveInteger(value.library?.id)
  const libraryName = nonEmptyString(value.library?.name)
  const mediaType = value.library?.mediaType === null ? null : nonEmptyString(value.library?.mediaType)
  const purposeProvenance = normalizeNativeIntentPurposeProvenance(value.purposeProvenance)
  if (!policyId || !policyName || !libraryId || !libraryName ||
    (value.library?.mediaType !== null && !mediaType) || !purposeProvenance) return null

  return Object.freeze({
    policy: Object.freeze({ id: policyId, name: policyName }),
    library: Object.freeze({ id: libraryId, name: libraryName, mediaType }),
    purposeProvenance,
  })
}

export function normalizePolicyPurposeProposalBatch(value) {
  if (!hasOnlyKeys(value, [
    'version', 'statusId', 'proposalFingerprint', 'summary', 'candidates', 'exceptions', 'action',
    'rawPurposeRulesExposed', 'policyStorageMutated', 'semanticSelectionAffected', 'routingAffected',
    'providerAccessed',
  ]) || value.version !== VERSION || !STATUS_IDS.has(value.statusId) ||
    value.rawPurposeRulesExposed !== false || value.policyStorageMutated !== false ||
    value.semanticSelectionAffected !== false || value.routingAffected !== false ||
    value.providerAccessed !== false || !Array.isArray(value.candidates) || !Array.isArray(value.exceptions) ||
    !hasOnlyKeys(value.summary, ['candidatePolicyCount', 'exceptionPolicyCount', 'reviewedPolicyCount', 'truncated']) ||
    typeof value.summary.truncated !== 'boolean') return null

  const candidates = value.candidates.map(normalizeEntry)
  const exceptions = value.exceptions.map(normalizeEntry)
  const candidatePolicyCount = nonNegativeInteger(value.summary.candidatePolicyCount)
  const exceptionPolicyCount = nonNegativeInteger(value.summary.exceptionPolicyCount)
  const reviewedPolicyCount = nonNegativeInteger(value.summary.reviewedPolicyCount)
  if (candidates.some(entry => !entry) || exceptions.some(entry => !entry) ||
    new Set([...candidates, ...exceptions].map(entry => entry?.policy.id)).size !== candidates.length + exceptions.length ||
    candidatePolicyCount !== candidates.length || exceptionPolicyCount !== exceptions.length ||
    reviewedPolicyCount !== candidates.length + exceptions.length) return null

  const ready = value.statusId === 'ready_for_apply'
  const candidatePolicyIds = Array.isArray(value.action?.candidatePolicyIds)
    ? value.action.candidatePolicyIds.map(positiveInteger)
    : []
  const fingerprint = typeof value.proposalFingerprint === 'string' ? value.proposalFingerprint : null
  if (!hasOnlyKeys(value.action, ['actionId', 'available', 'candidatePolicyIds']) ||
    value.action.actionId !== ACTION_ID || value.action.available !== ready ||
    candidatePolicyIds.some(id => !id) ||
    JSON.stringify(candidatePolicyIds) !== JSON.stringify(candidates.map(entry => entry.policy.id)) ||
    (ready && (!FINGERPRINT_PATTERN.test(fingerprint || '') || value.summary.truncated)) ||
    (!ready && (fingerprint !== null || candidatePolicyIds.length !== 0))) return null

  return Object.freeze({
    version: VERSION,
    statusId: value.statusId,
    proposalFingerprint: ready ? fingerprint : null,
    summary: Object.freeze({ candidatePolicyCount, exceptionPolicyCount, reviewedPolicyCount, truncated: value.summary.truncated }),
    candidates: Object.freeze(candidates),
    exceptions: Object.freeze(exceptions),
    action: Object.freeze({ actionId: ACTION_ID, available: ready, candidatePolicyIds: Object.freeze(candidatePolicyIds) }),
    rawPurposeRulesExposed: false,
    policyStorageMutated: false,
    semanticSelectionAffected: false,
    routingAffected: false,
    providerAccessed: false,
  })
}
