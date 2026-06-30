/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_BUILDER_SETUP_STEP_IDS,
  getPolicyBuilderSetupCard,
  listPolicyBuilderSetupCards,
} from '@/utils/policyBuilderSetupCards'

describe('policyBuilderSetupCards', () => {
  it('defines the Phase 3R setup cards in the normal operator sequence', () => {
    const cards = listPolicyBuilderSetupCards()

    expect(cards.map(card => card.stepId)).toEqual([
      POLICY_BUILDER_SETUP_STEP_IDS.OBSERVED_APPLICATION,
      POLICY_BUILDER_SETUP_STEP_IDS.DECLARED_DESTINATION_RULES,
      POLICY_BUILDER_SETUP_STEP_IDS.REVIEW_BEHAVIOR,
      POLICY_BUILDER_SETUP_STEP_IDS.ROUTING_AND_READINESS,
    ])
    expect(cards.map(card => card.heading)).toEqual([
      'What already belongs here?',
      'What should always or never belong here?',
      'When should Classifarr ask?',
      'Can this destination route?',
    ])
    expect(cards.every(card => card.targetId)).toBe(true)
  })

  it('returns immutable card records by step id', () => {
    const card = getPolicyBuilderSetupCard(POLICY_BUILDER_SETUP_STEP_IDS.OBSERVED_APPLICATION)

    expect(card).toMatchObject({
      primaryActionLabel: 'Review suggestions',
      termLabels: ['Belongs Here'],
      targetId: 'policy-builder-library-context',
    })
    expect(Object.isFrozen(listPolicyBuilderSetupCards())).toBe(true)
    expect(Object.isFrozen(card)).toBe(true)
    expect(Object.isFrozen(card.termLabels)).toBe(true)
    expect(getPolicyBuilderSetupCard('unknown')).toBeNull()
  })
})
