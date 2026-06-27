/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_BUILDER_WEIGHT_CONTROLS = Object.freeze([
  { field: 'preset_weight', label: 'Presets' },
  { field: 'profile_weight', label: 'Profile' },
  { field: 'pattern_weight', label: 'Patterns' },
  { field: 'rag_weight', label: 'RAG' },
  { field: 'history_weight', label: 'History' },
])

export const POLICY_BUILDER_THRESHOLD_CONTROLS = Object.freeze([
  {
    field: 'auto_classify_threshold',
    label: 'Auto-classify threshold',
    min: 50,
    max: 95,
    description: 'Items scoring above this will be auto-classified',
  },
  {
    field: 'prompt_threshold',
    label: 'Prompt threshold',
    min: 30,
    max: 80,
    description: 'Items scoring above this will prompt for confirmation',
  },
])

export const POLICY_BUILDER_COMBINATION_MODE_CONTROLS = Object.freeze([
  {
    value: 'best_match',
    label: 'Best Match',
    description: 'Use highest scoring preset',
  },
  {
    value: 'average',
    label: 'Average',
    description: 'Average all matching preset scores',
  },
  {
    value: 'weighted_average',
    label: 'Weighted Average',
    description: 'Use preset weights',
  },
  {
    value: 'require_all',
    label: 'Require All',
    description: 'All presets must match',
  },
])

export const POLICY_BUILDER_WEIGHT_FIELDS = Object.freeze(
  POLICY_BUILDER_WEIGHT_CONTROLS.map(control => control.field)
)

export const POLICY_BUILDER_THRESHOLD_FIELDS = Object.freeze(
  POLICY_BUILDER_THRESHOLD_CONTROLS.map(control => control.field)
)

export const POLICY_BUILDER_COMBINATION_MODES = Object.freeze(
  POLICY_BUILDER_COMBINATION_MODE_CONTROLS.map(control => control.value)
)

const FIELD_BOUNDS = Object.freeze({
  preset_weight: { min: 0, max: 1, precision: 2 },
  profile_weight: { min: 0, max: 1, precision: 2 },
  pattern_weight: { min: 0, max: 1, precision: 2 },
  rag_weight: { min: 0, max: 1, precision: 2 },
  history_weight: { min: 0, max: 1, precision: 2 },
  auto_classify_threshold: { min: 50, max: 95, integer: true },
  prompt_threshold: { min: 30, max: 80, integer: true },
})

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function formatPolicyBuilderPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}

export function normalizePolicyBuilderFormField(field, value) {
  if (field === 'combination_mode') {
    return POLICY_BUILDER_COMBINATION_MODES.includes(value) ? value : null
  }

  const bounds = FIELD_BOUNDS[field]
  if (!bounds) return null

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return null

  const clampedValue = clamp(numericValue, bounds.min, bounds.max)
  if (bounds.integer) {
    return Math.round(clampedValue)
  }

  const factor = 10 ** (bounds.precision || 2)
  return Math.round(clampedValue * factor) / factor
}
