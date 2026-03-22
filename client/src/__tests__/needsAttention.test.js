/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  binaryPolicyOptions,
  policyOptions,
  policyQuestion,
  primaryPolicyOption,
  suggestedLibraryLabel,
  targetedRecheckLine,
} from '@/utils/needsAttention'

describe('needsAttention utility helpers', () => {
  it('parses policy question JSON safely', () => {
    expect(policyQuestion({ policy_question: JSON.stringify({ question: 'Pick one?' }) })).toEqual({ question: 'Pick one?' })
    expect(policyQuestion({ policy_question: '{invalid' })).toBeNull()
  })

  it('filters option arrays and prefers mapped primary options', () => {
    const item = {
      policy_question: {
        options: [
          null,
          { label: 'Fallback', value: 'fallback' },
          { label: 'TV Shows', value: 'tv', library_id: 10 },
        ],
      },
    }

    expect(policyOptions(item)).toHaveLength(2)
    expect(primaryPolicyOption(item)).toEqual({ label: 'TV Shows', value: 'tv', library_id: 10 })
  })

  it('detects binary yes and no options from policy prompts', () => {
    const item = {
      policy_question: {
        options: [
          { label: 'Confirm', value: 'true', library_id: 10 },
          { label: 'Reject', value: 'false', library_id: 8 },
        ],
      },
    }

    expect(binaryPolicyOptions(item)).toEqual({
      yes: { label: 'Confirm', value: 'true', library_id: 10 },
      no: { label: 'Reject', value: 'false', library_id: 8 },
    })
  })

  it('builds suggested library labels and targeted re-check lines', () => {
    const item = {
      suggested_library_name: 'TV Shows',
      confidence: 44,
      metadata: {
        classification_details: {
          rag_loop_trace: {
            mode: 'shadow',
            ran: true,
            diagnostics: {
              pass1: { top_similarity: 0.44 },
              pass2: { top_similarity: 0.61 },
            },
            decision: {
              outcome: 'baseline',
              reason: 'no_change',
            },
          },
        },
      },
    }

    expect(suggestedLibraryLabel(item)).toBe('TV Shows')
    expect(targetedRecheckLine(item)).toContain('Targeted re-check ran')
    expect(targetedRecheckLine(item)).toContain('44% -> 61%')
  })
})
