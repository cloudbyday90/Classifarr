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
const MAX_PROFILE_RECOVERY_MESSAGE_LENGTH = 160
const PROFILE_RECOVERY_STATE_IDS = new Set([
  'not_required',
  'scheduled',
  'queued',
  'processing',
  'awaiting_automatic_probe',
])

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

function buildNativeProfileRecoverySummary(readinessSummary = {}) {
  const profileRecovery = readinessSummary?.profileRecovery
  const stateId = normalizeSummaryText(profileRecovery?.stateId)
  const label = normalizeSummaryText(profileRecovery?.label)
  const message = normalizeProfileRecoveryText(profileRecovery?.message)

  if (!PROFILE_RECOVERY_STATE_IDS.has(stateId) || !label || !message) {
    return {
      stateId: 'unavailable',
      label: 'Recovery status unavailable',
      message: 'Classifarr could not confirm automatic profile recovery status.',
    }
  }

  return { stateId, label, message }
}

function normalizeProfileRecoveryText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return ''

  return replaceControlCharacters(String(value).normalize('NFKC'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROFILE_RECOVERY_MESSAGE_LENGTH)
}

function buildNativePolicyReadinessSummary({ readinessSummary, loading = false, error = '' } = {}) {
  if (loading) {
    return {
      statusId: 'loading',
      label: 'Checking readiness',
      message: 'Classifarr is checking the stored policy intent, cached profile, and routing readiness.',
      nextActionLabel: '',
      profileRecovery: {
        stateId: 'checking',
        label: 'Checking recovery',
        message: 'Classifarr is checking automatic profile recovery status.',
      },
    }
  }

  if (error || !readinessSummary) {
    return {
      statusId: 'unavailable',
      label: 'Readiness unavailable',
      message: 'Classifarr could not load the current policy readiness.',
      nextActionLabel: '',
      profileRecovery: {
        stateId: 'unavailable',
        label: 'Recovery status unavailable',
        message: 'Classifarr could not confirm automatic profile recovery status.',
      },
    }
  }

  if (readinessSummary.statusId !== 'native_policy_readiness_available') {
    return {
      statusId: 'native_intent_unavailable',
      label: 'Native intent unavailable',
      message: 'Classifarr could not confirm one authoritative stored native intent for this policy.',
      nextActionLabel: '',
      profileRecovery: {
        stateId: 'unavailable',
        label: 'Recovery status unavailable',
        message: 'Classifarr could not confirm automatic profile recovery status.',
      },
    }
  }

  const readiness = readinessSummary.readiness
  const nextActionLabel = normalizeSummaryText(readiness?.nextAction?.label)

  if (readiness.ready === true) {
    return {
      statusId: 'ready',
      label: 'Ready',
      message: 'The stored policy intent, cached profile, and routing state are ready for automation.',
      nextActionLabel,
      profileRecovery: buildNativeProfileRecoverySummary(readinessSummary),
    }
  }

  return {
    statusId: 'needs_action',
    label: 'Needs action',
    message: 'The stored policy needs attention before automation continues.',
    nextActionLabel,
    profileRecovery: buildNativeProfileRecoverySummary(readinessSummary),
  }
}

export {
  buildNativeProfileRecoverySummary,
  buildNativePolicyReadinessSummary,
  buildNativePurposeSummary,
}
