/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildNativeIntentPurposeChangeCommand,
  cloneNativeIntentPurposeChangeRules,
  parseNativePurposeTerms,
} from '@/utils/policyNativeIntentPurposeChange'

describe('policyNativeIntentPurposeChange', () => {
  it('normalizes bounded terms and builds the one permitted native purpose command', () => {
    expect(parseNativePurposeTerms(' Animation, Anime, Animation, bad\u0000term '))
      .toEqual(['Animation', 'Anime', 'bad term'])

    expect(buildNativeIntentPurposeChangeCommand([{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: ['Animation', 'Anime'] },
      constraint_mode: 'advisory',
      semantics: 'identity',
    }])).toEqual({
      command_id: 'update_purpose',
      values: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: ['Animation', 'Anime'] },
        constraint_mode: 'advisory',
        semantics: 'identity',
      }],
    })
  })

  it('does not create a command from an incomplete or unsupported draft', () => {
    expect(buildNativeIntentPurposeChangeCommand([{
      signal_type: 'genres',
      operator: 'require_any',
      values: { require_any: [] },
    }])).toBeNull()
    expect(cloneNativeIntentPurposeChangeRules({
      command_id: 'update_purpose',
      values: [{ signal_type: 'unsupported', values: { require_any: ['Animation'] } }],
    })).toBeNull()
  })
})
