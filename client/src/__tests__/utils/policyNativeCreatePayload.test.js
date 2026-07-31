/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, expect, it } from 'vitest'
import {
  NATIVE_POLICY_CREATE_REQUEST_FIELDS,
  buildNativePolicyCreatePayload,
} from '@/utils/policyNativeCreatePayload'

const nativeIntentEstablishment = {
  declared_intent: {
    purpose: [{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Animation'] },
    }],
    hard_limits: [],
    helpful_hints: [],
    avoid: [],
  },
}

describe('policyNativeCreatePayload', () => {
  it('serializes only native create fields from a legacy-capable form', () => {
    const payload = buildNativePolicyCreatePayload({
      formValue: {
        library_id: 4,
        name: '',
        description: 'Hidden compatibility description',
        enabled: false,
        priority: 9,
        auto_classify_threshold: 91,
        prompt_threshold: 72,
        require_ai_validation: false,
        trust_patterns: false,
        trust_rag: false,
        trust_history: false,
        preset_weight: 0.5,
        profile_weight: 0.5,
        pattern_weight: 0,
        rag_weight: 0,
        history_weight: 0,
        combination_mode: 'consensus',
      },
      currentLibrary: { id: 4, name: 'Animation Movies' },
      nativeIntentEstablishment,
    })

    expect(payload).toEqual({
      library_id: 4,
      name: 'Animation Movies Policy',
      native_intent_establishment: nativeIntentEstablishment,
    })
    expect(Object.keys(payload).sort()).toEqual([...NATIVE_POLICY_CREATE_REQUEST_FIELDS].sort())
  })

  it('uses an explicit policy name without accepting an invalid native request', () => {
    expect(buildNativePolicyCreatePayload({
      formValue: { library_id: 4, name: 'Animation destination' },
      currentLibrary: { id: 4, name: 'Animation Movies' },
      nativeIntentEstablishment,
    })).toMatchObject({
      library_id: 4,
      name: 'Animation destination',
    })

    expect(buildNativePolicyCreatePayload({
      formValue: { library_id: 0 },
      currentLibrary: { id: 4, name: 'Animation Movies' },
      nativeIntentEstablishment,
    })).toBeNull()
  })
})
