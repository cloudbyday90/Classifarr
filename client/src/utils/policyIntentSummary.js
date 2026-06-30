/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { POLICY_INTENT_BUCKETS } from './policyIntentModel'
import { getPolicyReviewTriggerOption } from './policyReviewTriggers'

const VALUE_KEYS = ['require_all', 'require_any', 'include', 'prefer', 'exclude', 'when_any']

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(item => item !== undefined && item !== null && String(item).trim()) : []
}

function formatValueList(values) {
  for (const key of VALUE_KEYS) {
    const list = asArray(values[key])
    if (list.length > 0) {
      if (key === 'when_any') {
        return list.map(value => getPolicyReviewTriggerOption(value)?.label || value).join(', ')
      }
      return list.join(', ')
    }
  }

  if (values.mode === 'max' && values.max) return `max ${values.max}`
  if (values.mode === 'min' && values.min) return `min ${values.min}`
  if (values.max_minutes) return `max ${values.max_minutes} minutes`
  if (values.min_minutes) return `min ${values.min_minutes} minutes`

  return ''
}

function formatEntry(entry) {
  const signalType = entry?.signal_type || 'signal'
  const valueText = formatValueList(asObject(entry?.values))
  return valueText ? `${signalType}: ${valueText}` : signalType
}

function mapEntries(entries = []) {
  return entries.map(entry => ({
    text: formatEntry(entry),
    source: entry?.preset_name || 'Selected starter template',
    signal_type: entry?.signal_type || null,
  }))
}

function buildReviewTriggers(intentView, counts) {
  const warnings = []
  const presetCount = intentView?.summary?.preset_count || 0
  const identityCount = counts[POLICY_INTENT_BUCKETS.IDENTITY] || 0
  const compatibilityCount = counts[POLICY_INTENT_BUCKETS.COMPATIBILITY] || 0
  const strictCount = counts[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS] || 0
  const boosterCount = counts[POLICY_INTENT_BUCKETS.BOOSTERS] || 0
  const exclusionCount = counts[POLICY_INTENT_BUCKETS.EXCLUSIONS] || 0

  if (presetCount === 0) {
    warnings.push('Select at least one starter template before saving policy intent.')
  }

  if (identityCount === 0) {
    warnings.push('No belongs-here signals are defined yet.')
  }

  if (strictCount === 0 && exclusionCount === 0) {
    warnings.push('No hard limits or avoid rules are defined.')
  }

  if (identityCount === 0 && (compatibilityCount + boosterCount) > 0) {
    warnings.push('Helpful matches cannot decide the destination without belongs-here signals.')
  }

  return warnings.map(text => ({
    text,
    source: 'Policy intent check',
    signal_type: null,
  }))
}

export function buildPolicyIntentSummary(intentView = {}) {
  const view = asObject(intentView)
  const counts = {
    [POLICY_INTENT_BUCKETS.IDENTITY]: asArray(view[POLICY_INTENT_BUCKETS.IDENTITY]).length,
    [POLICY_INTENT_BUCKETS.COMPATIBILITY]: asArray(view[POLICY_INTENT_BUCKETS.COMPATIBILITY]).length,
    [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: asArray(view[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]).length,
    [POLICY_INTENT_BUCKETS.BOOSTERS]: asArray(view[POLICY_INTENT_BUCKETS.BOOSTERS]).length,
    [POLICY_INTENT_BUCKETS.EXCLUSIONS]: asArray(view[POLICY_INTENT_BUCKETS.EXCLUSIONS]).length,
    [POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS]: asArray(view[POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS]).length,
  }
  const reviewTriggers = buildReviewTriggers(view, counts)

  return {
    preset_count: view?.summary?.preset_count || 0,
    counts,
    has_warnings: reviewTriggers.length > 0,
    sections: [
      {
        key: 'purpose',
        label: 'Purpose',
        help: 'Signals that define what belongs in this library.',
        tone: 'green',
        emptyText: 'No belongs-here signals yet.',
        items: mapEntries(view[POLICY_INTENT_BUCKETS.IDENTITY]),
      },
      {
        key: 'hard_limits',
        label: 'Hard Limits',
        help: 'Constraints and avoid rules that can block a bad match.',
        tone: 'amber',
        emptyText: 'No hard limits or avoid rules yet.',
        items: [
          ...mapEntries(view[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]),
          ...mapEntries(view[POLICY_INTENT_BUCKETS.EXCLUSIONS]),
        ],
      },
      {
        key: 'helpful_hints',
        label: 'Helpful Hints',
        help: 'Soft evidence that can help after the destination already fits.',
        tone: 'blue',
        emptyText: 'No helpful hints yet.',
        items: [
          ...mapEntries(view[POLICY_INTENT_BUCKETS.COMPATIBILITY]),
          ...mapEntries(view[POLICY_INTENT_BUCKETS.BOOSTERS]),
        ],
      },
      {
        key: 'review_triggers',
        label: 'Review Triggers',
        help: 'Declared conditions and deterministic checks that explain when Classifarr should ask.',
        tone: reviewTriggers.length > 0 ? 'red' : 'gray',
        emptyText: 'No review triggers detected.',
        items: [
          ...mapEntries(view[POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS]),
          ...reviewTriggers,
        ],
      },
    ],
  }
}
