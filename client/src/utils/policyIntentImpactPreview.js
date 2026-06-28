/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const BUCKET_LABELS = Object.freeze({
  identity_signals: 'Belongs Here',
  compatibility_signals: 'Helpful Matches',
  strict_constraints: 'Hard Limits',
  boosters: 'Boosts',
  exclusions: 'Avoid',
})

const ALLOWED_PARITY = new Set(['matching', 'different', 'unavailable'])
const ALLOWED_IMPACT_LEVELS = new Set(['none', 'medium', 'high', 'unknown'])

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function boundedNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback
}

function boundedString(value, fallback = 'unknown') {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 120) : fallback
}

function normalizeCounts(counts) {
  const value = asObject(counts)
  return Object.keys(BUCKET_LABELS).reduce((normalized, bucket) => ({
    ...normalized,
    [bucket]: boundedNumber(value[bucket]),
  }), {})
}

function normalizeBucketDelta(delta) {
  const value = asObject(delta)
  const bucket = boundedString(value.bucket)

  return {
    bucket,
    label: BUCKET_LABELS[bucket] || bucket,
    legacy_count: boundedNumber(value.legacy_count),
    native_count: boundedNumber(value.native_count),
    matching_signals: boundedNumber(value.matching_signals),
    removed_signals: boundedNumber(value.removed_signals),
    added_signals: boundedNumber(value.added_signals),
    changed: value.changed === true,
    reason_codes: asArray(value.reason_codes)
      .filter(reason => typeof reason === 'string')
      .slice(0, 8),
  }
}

export function normalizePolicyIntentImpactPreview(preview) {
  const value = asObject(preview)
  if (Object.keys(value).length === 0) {
    return null
  }

  const validation = asObject(value.validation)
  const legacy = asObject(value.legacy)
  const nativeDraft = asObject(value.native_draft)
  const comparison = asObject(value.comparison)
  const parity = ALLOWED_PARITY.has(comparison.parity) ? comparison.parity : 'unavailable'
  const impactLevel = ALLOWED_IMPACT_LEVELS.has(comparison.impact_level)
    ? comparison.impact_level
    : 'unknown'

  return {
    schema_version: boundedNumber(value.schema_version, 1),
    mode: boundedString(value.mode, 'non_persistent_preview'),
    persistence_enabled: value.persistence_enabled === true,
    validation: {
      valid: validation.valid === true,
      errors: asArray(validation.errors).filter(error => typeof error === 'string').slice(0, 8),
    },
    legacy: {
      preset_count: boundedNumber(legacy.preset_count),
      counts: normalizeCounts(legacy.counts),
      warning_count: boundedNumber(legacy.warning_count),
      warning_reason_codes: asArray(legacy.warning_reason_codes)
        .filter(reason => typeof reason === 'string')
        .slice(0, 8),
    },
    native_draft: {
      present: nativeDraft.present === true,
      draft_schema_version: boundedNumber(nativeDraft.draft_schema_version, null),
      source: boundedString(nativeDraft.source, 'unknown'),
      migration_state: boundedString(nativeDraft.migration_state, 'unknown'),
      preset_count: boundedNumber(nativeDraft.preset_count),
      counts: normalizeCounts(nativeDraft.counts),
    },
    comparison: {
      parity,
      impact_level: impactLevel,
      changed_buckets: asArray(comparison.changed_buckets)
        .filter(bucket => typeof bucket === 'string')
        .slice(0, 8),
      bucket_deltas: asArray(comparison.bucket_deltas).map(normalizeBucketDelta).slice(0, 8),
      reason_codes: asArray(comparison.reason_codes)
        .filter(reason => typeof reason === 'string')
        .slice(0, 8),
    },
  }
}

export function buildPolicyIntentImpactPreviewNotice(preview) {
  const normalized = normalizePolicyIntentImpactPreview(preview)
  if (!normalized) {
    return null
  }

  if (!normalized.validation.valid) {
    return {
      tone: 'error',
      title: 'Preview validation failed',
      message: 'The server rejected the intent draft before previewing policy impact.',
    }
  }

  if (normalized.comparison.parity === 'matching') {
    return {
      tone: 'success',
      title: 'Intent preview matches saved policy behavior',
      message: 'The native intent draft and legacy preset path express the same policy structure.',
    }
  }

  if (normalized.comparison.impact_level === 'high') {
    return {
      tone: 'warning',
      title: 'High-impact intent drift detected',
      message: 'Belongs Here, Hard Limits, or Avoid signals differ from the legacy policy path. Review before saving.',
    }
  }

  if (normalized.comparison.parity === 'different') {
    return {
      tone: 'warning',
      title: 'Intent preview differs from saved policy behavior',
      message: 'Some non-critical policy signals differ from the legacy preset path. Review the changed sections before saving.',
    }
  }

  return {
    tone: 'info',
    title: 'Intent preview unavailable',
    message: 'The server could not compare the current draft against the legacy policy path.',
  }
}

export function summarizePolicyIntentImpactChangedBuckets(preview) {
  const normalized = normalizePolicyIntentImpactPreview(preview)
  if (!normalized) {
    return []
  }

  return normalized.comparison.bucket_deltas
    .filter(delta => delta.changed)
    .map(delta => ({
      bucket: delta.bucket,
      label: delta.label,
      legacy_count: delta.legacy_count,
      native_count: delta.native_count,
      added_signals: delta.added_signals,
      removed_signals: delta.removed_signals,
    }))
}
