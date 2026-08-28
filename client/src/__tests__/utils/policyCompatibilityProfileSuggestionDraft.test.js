/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyCompatibilityProfileSuggestionDraftPlan,
} from '@/utils/policyCompatibilityProfileSuggestionDraft'

const rules = [{
  signalType: 'genres',
  operator: 'require_any',
  values: ['Animation', 'Family'],
  semantics: 'identity',
  constraintMode: 'advisory',
}]

describe('policyCompatibilityProfileSuggestionDraft', () => {
  it('creates a local, additive genre-draft command for exactly one policy context', () => {
    expect(buildPolicyCompatibilityProfileSuggestionDraftPlan({
      selectedPresets: [{ preset_id: 12, name: 'Kids TV' }],
      rules,
    })).toEqual({
      ok: true,
      reasonId: null,
      commands: [{
        presetId: 12,
        signalType: 'genres',
        config: {
          require_any: ['Animation', 'Family'],
          semantics: 'identity',
          constraint_mode: 'advisory',
        },
        appendArrays: true,
      }],
    })
  })

  it.each([
    ['no policy context', [], rules, 'single_policy_context_required'],
    ['multiple policy contexts', [{ preset_id: 1 }, { preset_id: 2 }], rules, 'single_policy_context_required'],
    ['unsupported source rule', [{ preset_id: 1 }], [{ signalType: 'studios' }], 'profile_suggestion_invalid'],
  ])('rejects %s without preparing a draft mutation', (_name, selectedPresets, invalidRules, reasonId) => {
    expect(buildPolicyCompatibilityProfileSuggestionDraftPlan({
      selectedPresets,
      rules: invalidRules,
    })).toEqual({ ok: false, reasonId, commands: [] })
  })
})
