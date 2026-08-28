/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const MAX_PROFILE_SUGGESTION_VALUES = 5
const MAX_PROFILE_SUGGESTION_VALUE_LENGTH = 120

function normalizeString(value, maximumLength = MAX_PROFILE_SUGGESTION_VALUE_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return null

  const normalized = String(value)
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength)

  return normalized || null
}

function getPresetId(preset) {
  const value = preset?.preset_id ?? preset?.id
  return value === undefined || value === null || value === '' ? null : value
}

function normalizeGenreRule(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule) ||
    rule.signalType !== 'genres' || rule.operator !== 'require_any' ||
    rule.semantics !== 'identity' || rule.constraintMode !== 'advisory' ||
    !Array.isArray(rule.values)) {
    return null
  }

  const values = Array.from(new Set(rule.values
    .map(value => normalizeString(value))
    .filter(Boolean)))
    .slice(0, MAX_PROFILE_SUGGESTION_VALUES)
  if (values.length === 0) return null

  return {
    signalType: 'genres',
    config: {
      require_any: values,
      semantics: 'identity',
      constraint_mode: 'advisory',
    },
  }
}

/**
 * Builds only local draft commands. The caller remains responsible for the
 * existing policy-save flow; no profile suggestion can perform a write.
 */
export function buildPolicyCompatibilityProfileSuggestionDraftPlan({ selectedPresets, rules } = {}) {
  const presets = Array.isArray(selectedPresets) ? selectedPresets : []
  if (presets.length !== 1) {
    return { ok: false, reasonId: 'single_policy_context_required', commands: [] }
  }

  const presetId = getPresetId(presets[0])
  const normalizedRules = Array.isArray(rules)
    ? rules.map(normalizeGenreRule).filter(Boolean)
    : []
  if (presetId === null || normalizedRules.length !== 1) {
    return { ok: false, reasonId: 'profile_suggestion_invalid', commands: [] }
  }

  return {
    ok: true,
    reasonId: null,
    commands: normalizedRules.map(rule => ({
      presetId,
      signalType: rule.signalType,
      config: rule.config,
      appendArrays: true,
    })),
  }
}
