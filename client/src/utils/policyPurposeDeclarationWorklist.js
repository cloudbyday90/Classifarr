/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  normalizeNativeIntentPurposeProvenance,
} from './policyNativeIntentPurposeProvenance'

const VERSION = 'policy_purpose_declaration_worklist.v1'
const STATUS_IDS = new Set([
  'declaration_review_required',
  'no_declaration_review_required',
])
const ACTION_ID = 'review_and_declare_purpose'

function hasOnlyKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actualKeys = Object.keys(value).sort()
  const expectedKeys = [...keys].sort()
  return actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
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

function normalizeIdentity(value, { allowMediaType = false } = {}) {
  const keys = allowMediaType ? ['id', 'name', 'mediaType'] : ['id', 'name']
  if (!hasOnlyKeys(value, keys)) return null

  const id = positiveInteger(value.id)
  const name = nonEmptyString(value.name)
  const mediaType = allowMediaType && value.mediaType !== null
    ? nonEmptyString(value.mediaType)
    : null
  if (!id || !name || (allowMediaType && value.mediaType !== null && !mediaType)) return null

  return Object.freeze(allowMediaType ? { id, name, mediaType } : { id, name })
}

function normalizeEntry(value) {
  if (!hasOnlyKeys(value, ['policy', 'library', 'purposeProvenance', 'action'])) return null
  const policy = normalizeIdentity(value.policy)
  const library = normalizeIdentity(value.library, { allowMediaType: true })
  const purposeProvenance = normalizeNativeIntentPurposeProvenance(value.purposeProvenance)
  const action = value.action
  if (!policy || !library || !purposeProvenance ||
    !hasOnlyKeys(action, ['actionId', 'available']) ||
    action.actionId !== ACTION_ID || action.available !== true) return null

  return Object.freeze({
    policy,
    library,
    purposeProvenance,
    action: Object.freeze({ actionId: ACTION_ID, available: true }),
  })
}

function normalizeGroup(value) {
  if (!hasOnlyKeys(value, ['id', 'policyCount', 'libraryCount', 'entries'])) return null
  const id = nonEmptyString(value.id)
  const policyCount = positiveInteger(value.policyCount)
  const libraryCount = positiveInteger(value.libraryCount)
  if (!id || !/^purpose_declaration_group_[1-9]\d*$/u.test(id) ||
    !policyCount || !libraryCount || !Array.isArray(value.entries)) return null

  const entries = value.entries.map(normalizeEntry)
  if (entries.some(entry => !entry) || entries.length !== policyCount ||
    new Set(entries.map(entry => entry.policy.id)).size !== policyCount) return null
  if (new Set(entries.map(entry => entry.library.id)).size !== libraryCount) return null

  return Object.freeze({ id, policyCount, libraryCount, entries: Object.freeze(entries) })
}

export function normalizePolicyPurposeDeclarationWorklist(value) {
  if (!hasOnlyKeys(value, [
    'version',
    'statusId',
    'groups',
    'summary',
    'rawPurposeRulesExposed',
    'policyStorageMutated',
    'semanticSelectionAffected',
    'routingAffected',
  ])) return null
  if (value.version !== VERSION || !STATUS_IDS.has(value.statusId) ||
    value.rawPurposeRulesExposed !== false || value.policyStorageMutated !== false ||
    value.semanticSelectionAffected !== false || value.routingAffected !== false ||
    !Array.isArray(value.groups) ||
    !hasOnlyKeys(value.summary, [
      'reviewedPolicyCount',
      'declarationRequiredPolicyCount',
      'groupCount',
      'truncated',
    ])) return null

  const groups = value.groups.map(normalizeGroup)
  const reviewedPolicyCount = nonNegativeInteger(value.summary.reviewedPolicyCount)
  const declarationRequiredPolicyCount = nonNegativeInteger(value.summary.declarationRequiredPolicyCount)
  const groupCount = nonNegativeInteger(value.summary.groupCount)
  if (groups.some(group => !group) || new Set(groups.map(group => group.id)).size !== groups.length ||
    new Set(groups.flatMap(group => group?.entries || []).map(entry => entry.policy.id)).size !==
      groups.reduce((count, group) => count + (group?.policyCount || 0), 0) ||
    reviewedPolicyCount === null ||
    declarationRequiredPolicyCount === null || groupCount === null ||
    typeof value.summary.truncated !== 'boolean' || groupCount !== groups.length ||
    declarationRequiredPolicyCount !== groups.reduce((count, group) => count + group.policyCount, 0) ||
    declarationRequiredPolicyCount > reviewedPolicyCount ||
    (value.statusId === 'declaration_review_required') !== (declarationRequiredPolicyCount > 0)) return null

  return Object.freeze({
    version: VERSION,
    statusId: value.statusId,
    groups: Object.freeze(groups),
    summary: Object.freeze({
      reviewedPolicyCount,
      declarationRequiredPolicyCount,
      groupCount,
      truncated: value.summary.truncated,
    }),
    rawPurposeRulesExposed: false,
    policyStorageMutated: false,
    semanticSelectionAffected: false,
    routingAffected: false,
  })
}
