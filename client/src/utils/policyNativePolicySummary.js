/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { hasServerReportedNativePolicyIntent } from './policyNativePolicyAuthority'

const MAX_PURPOSE_RULES = 8
const MAX_PURPOSE_VALUES_PER_RULE = 4
const MAX_SUMMARY_TEXT_LENGTH = 80

function replaceControlCharacters(value) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127 ? ' ' : character
  }).join('')
}

function normalizeSummaryText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''

  return replaceControlCharacters(String(value).normalize('NFKC'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUMMARY_TEXT_LENGTH)
}

function formatSignalType(value) {
  const signalType = normalizeSummaryText(value)
  if (!signalType) return ''

  return signalType
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}

function listRuleValues(rule = {}) {
  const values = rule?.values
  if (!values || typeof values !== 'object' || Array.isArray(values)) return []

  const normalizedValues = Object.values(values)
    .filter(Array.isArray)
    .flat()
    .map(normalizeSummaryText)
    .filter(Boolean)

  return [...new Set(normalizedValues)].slice(0, MAX_PURPOSE_VALUES_PER_RULE)
}

function buildPurposeLine(rule = {}) {
  const signalType = formatSignalType(rule?.signal_type)
  if (!signalType) return ''

  const values = listRuleValues(rule)
  return values.length > 0
    ? `${signalType}: ${values.join(', ')}`
    : signalType
}

function buildNativePurposeSummary(policy = {}) {
  if (!hasServerReportedNativePolicyIntent(policy)) return []

  const purpose = Array.isArray(policy?.policy_intent_contract?.purpose)
    ? policy.policy_intent_contract.purpose
    : []

  return purpose
    .map(buildPurposeLine)
    .filter(Boolean)
    .slice(0, MAX_PURPOSE_RULES)
}

function buildNativeLibraryReadinessSummary({ workflowRead, loading = false, error = '' } = {}) {
  if (loading) {
    return {
      statusId: 'loading',
      label: 'Checking readiness',
      message: 'Classifarr is checking the current library readiness.',
      nextActionLabel: '',
    }
  }

  if (error || !workflowRead?.workflow?.readiness) {
    return {
      statusId: 'unavailable',
      label: 'Readiness unavailable',
      message: 'Classifarr could not load the current library readiness.',
      nextActionLabel: '',
    }
  }

  const readiness = workflowRead.workflow.readiness
  const nextActionLabel = normalizeSummaryText(readiness?.nextAction?.label)

  if (readiness.ready === true) {
    return {
      statusId: 'ready',
      label: 'Ready',
      message: 'The server reports that the current library is ready for automation.',
      nextActionLabel,
    }
  }

  return {
    statusId: 'needs_action',
    label: 'Needs action',
    message: 'The server reports that the current library needs attention before automation continues.',
    nextActionLabel,
  }
}

export {
  buildNativeLibraryReadinessSummary,
  buildNativePurposeSummary,
}
