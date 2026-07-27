/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildNativeLibraryReadinessSummary,
  buildNativePurposeSummary,
} from '@/utils/policyNativePolicySummary'

describe('policyNativePolicySummary', () => {
  it('projects bounded purpose lines from the server-reported native contract', () => {
    expect(buildNativePurposeSummary({
      policy_intent_contract: {
        source: 'native_intent',
        purpose: [{
          signal_type: 'genres',
          values: { require_any: ['Animation\u0000', 'Anime', 'Animation\u0000'] },
        }],
      },
    })).toEqual(['Genres: Animation, Anime'])
  })

  it('does not present purpose lines for a non-native contract', () => {
    expect(buildNativePurposeSummary({
      policy_intent_contract: {
        source: 'legacy_presets',
        purpose: [{
          signal_type: 'genres',
          values: { require_any: ['Animation'] },
        }],
      },
    })).toEqual([])
  })

  it('uses the server workflow as a current library readiness display', () => {
    expect(buildNativeLibraryReadinessSummary({
      workflowRead: {
        workflow: {
          readiness: {
            ready: false,
            nextAction: { label: 'Configure routing' },
          },
        },
      },
    })).toEqual({
      statusId: 'needs_action',
      label: 'Needs action',
      message: 'The server reports that the current library needs attention before automation continues.',
      nextActionLabel: 'Configure routing',
    })
  })

  it('reports a bounded unavailable state instead of exposing a workflow error', () => {
    expect(buildNativeLibraryReadinessSummary({
      error: 'Unsafe raw failure detail',
    })).toEqual({
      statusId: 'unavailable',
      label: 'Readiness unavailable',
      message: 'Classifarr could not load the current library readiness.',
      nextActionLabel: '',
    })
  })
})
