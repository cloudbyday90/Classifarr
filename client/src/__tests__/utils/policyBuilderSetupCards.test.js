/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_BUILDER_SETUP_CARD_STATUS,
  POLICY_BUILDER_SETUP_STEP_IDS,
  buildPolicyBuilderSetupCardState,
  buildPolicyBuilderSetupCardViewModels,
} from '@/utils/policyBuilderSetupCards'

describe('policyBuilderSetupCards', () => {
  it('marks observed application complete when current-library evidence is available', () => {
    const state = buildPolicyBuilderSetupCardState(
      POLICY_BUILDER_SETUP_STEP_IDS.OBSERVED_APPLICATION,
      {
        library: { id: 1, name: 'Animated Movies' },
        libraryProfileGenreSummary: ['Animation', 'Family'],
      },
    )

    expect(state).toMatchObject({
      status: POLICY_BUILDER_SETUP_CARD_STATUS.COMPLETE,
      statusLabel: 'Evidence ready',
    })
    expect(state.statusMessage).toContain('2 current-library genre signals')
  })

  it('marks destination rules complete when the draft has declared intent', () => {
    const state = buildPolicyBuilderSetupCardState(
      POLICY_BUILDER_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
      {
        intentSummary: {
          counts: {
            identity_signals: 1,
            compatibility_signals: 0,
            strict_constraints: 1,
            boosters: 0,
            exclusions: 0,
          },
        },
      },
    )

    expect(state).toMatchObject({
      status: POLICY_BUILDER_SETUP_CARD_STATUS.COMPLETE,
      statusLabel: 'Rules started',
    })
    expect(state.statusMessage).toContain('2 declared destination signals')
  })

  it('keeps review behavior optional when only deterministic safeguards apply', () => {
    const state = buildPolicyBuilderSetupCardState(
      POLICY_BUILDER_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
      { intentSummary: { counts: { review_triggers: 0 } } },
    )

    expect(state).toMatchObject({
      status: POLICY_BUILDER_SETUP_CARD_STATUS.OPTIONAL,
      statusLabel: 'Default checks',
    })
  })

  it('mirrors routing readiness without exposing routing diagnostics', () => {
    const state = buildPolicyBuilderSetupCardState(
      POLICY_BUILDER_SETUP_STEP_IDS.ROUTING_AND_READINESS,
      {
        routingReadiness: {
          canRoute: false,
          label: 'Connect a routing target',
        },
      },
    )

    expect(state).toMatchObject({
      status: POLICY_BUILDER_SETUP_CARD_STATUS.NEEDS_ACTION,
      statusLabel: 'Needs setup',
      statusMessage: 'Connect a routing target',
    })
    expect(JSON.stringify(state)).not.toMatch(/arr_config_id|resolver|library_arr_mappings/i)
  })

  it('returns setup card view models with state for every card', () => {
    const cards = buildPolicyBuilderSetupCardViewModels({
      library: { id: 1 },
      intentSummary: {
        counts: {
          identity_signals: 1,
          compatibility_signals: 0,
          strict_constraints: 0,
          boosters: 0,
          exclusions: 0,
          review_triggers: 1,
        },
      },
      libraryProfileGenreSummary: ['Animation'],
      routingReadiness: { canRoute: true, label: 'Routing target ready' },
    })

    expect(cards).toHaveLength(4)
    expect(cards.every(card => card.state?.status)).toBe(true)
    expect(cards.map(card => card.state.statusLabel)).toEqual([
      'Evidence ready',
      'Rules started',
      'Review set',
      'Ready',
    ])
  })
})
