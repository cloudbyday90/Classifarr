/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_BUILDER_COMBINATION_MODE_CONTROLS,
  POLICY_BUILDER_COMBINATION_MODES,
  POLICY_BUILDER_THRESHOLD_CONTROLS,
  POLICY_BUILDER_THRESHOLD_FIELDS,
  POLICY_BUILDER_WEIGHT_CONTROLS,
  POLICY_BUILDER_WEIGHT_FIELDS,
  formatPolicyBuilderPercent,
  normalizePolicyBuilderFormField,
} from '@/utils/policyBuilderAdvancedControls'

describe('policyBuilderAdvancedControls', () => {
  it('exposes stable field lists from the rendered controls', () => {
    expect(POLICY_BUILDER_WEIGHT_FIELDS).toEqual(
      POLICY_BUILDER_WEIGHT_CONTROLS.map(control => control.field)
    )
    expect(POLICY_BUILDER_THRESHOLD_FIELDS).toEqual(
      POLICY_BUILDER_THRESHOLD_CONTROLS.map(control => control.field)
    )
    expect(POLICY_BUILDER_COMBINATION_MODES).toEqual(
      POLICY_BUILDER_COMBINATION_MODE_CONTROLS.map(control => control.value)
    )
  })

  it('normalizes allowed advanced form fields using bounded values', () => {
    expect(normalizePolicyBuilderFormField('preset_weight', 1.25)).toBe(1)
    expect(normalizePolicyBuilderFormField('profile_weight', -1)).toBe(0)
    expect(normalizePolicyBuilderFormField('pattern_weight', 0.333)).toBe(0.33)
    expect(normalizePolicyBuilderFormField('auto_classify_threshold', 49)).toBe(50)
    expect(normalizePolicyBuilderFormField('auto_classify_threshold', 96)).toBe(95)
    expect(normalizePolicyBuilderFormField('prompt_threshold', 99)).toBe(80)
    expect(normalizePolicyBuilderFormField('prompt_threshold', 30.4)).toBe(30)
    expect(normalizePolicyBuilderFormField('combination_mode', 'require_all')).toBe('require_all')
  })

  it('rejects unknown, unsafe, and non-finite advanced form updates', () => {
    expect(normalizePolicyBuilderFormField('unknown_field', 1)).toBeNull()
    expect(normalizePolicyBuilderFormField('combination_mode', 'unsafe')).toBeNull()
    expect(normalizePolicyBuilderFormField('preset_weight', Number.NaN)).toBeNull()
    expect(normalizePolicyBuilderFormField('preset_weight', Infinity)).toBeNull()
  })

  it('formats fractional weights as whole percents for display', () => {
    expect(formatPolicyBuilderPercent(1)).toBe('100%')
    expect(formatPolicyBuilderPercent(0.255)).toBe('26%')
    expect(formatPolicyBuilderPercent(null)).toBe('0%')
  })
})
