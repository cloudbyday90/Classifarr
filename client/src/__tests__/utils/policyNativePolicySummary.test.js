/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildNativePolicyReadinessSummary,
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

  it('uses the stored native policy readiness summary rather than a library workflow', () => {
    expect(buildNativePolicyReadinessSummary({
      readinessSummary: {
        statusId: 'native_policy_readiness_available',
        profileRecovery: {
          stateId: 'scheduled',
          label: 'Recovery scheduled',
          message: 'Classifarr will refresh this library profile automatically in the background. No action is needed.',
        },
        readiness: {
          ready: false,
          nextAction: { label: 'Configure routing' },
        },
      },
    })).toEqual({
      statusId: 'needs_action',
      label: 'Needs action',
      message: 'The stored policy needs attention before automation continues.',
      nextActionLabel: 'Configure routing',
      profileRecovery: {
        stateId: 'scheduled',
        label: 'Recovery scheduled',
        message: 'Classifarr will refresh this library profile automatically in the background. No action is needed.',
      },
    })
  })

  it('reports a bounded unavailable state instead of exposing a workflow error', () => {
    expect(buildNativePolicyReadinessSummary({
      error: 'Unsafe raw failure detail',
    })).toEqual({
      statusId: 'unavailable',
      label: 'Readiness unavailable',
      message: 'Classifarr could not load the current policy readiness.',
      nextActionLabel: '',
      profileRecovery: {
        stateId: 'unavailable',
        label: 'Recovery status unavailable',
        message: 'Classifarr could not confirm automatic profile recovery status.',
      },
    })
  })

  it('reports missing authoritative native intent without displaying untrusted readiness', () => {
    expect(buildNativePolicyReadinessSummary({
      readinessSummary: {
        statusId: 'native_policy_readiness_native_intent_unavailable',
      },
    })).toEqual({
      statusId: 'native_intent_unavailable',
      label: 'Native intent unavailable',
      message: 'Classifarr could not confirm one authoritative stored native intent for this policy.',
      nextActionLabel: '',
      profileRecovery: {
        stateId: 'unavailable',
        label: 'Recovery status unavailable',
        message: 'Classifarr could not confirm automatic profile recovery status.',
      },
    })
  })
})
