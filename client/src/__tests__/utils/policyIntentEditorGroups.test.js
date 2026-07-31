/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import {
  POLICY_INTENT_EDITOR_GROUP_IDS,
  buildPolicyIntentEditorGroups,
} from '@/utils/policyIntentEditorGroups'

describe('policyIntentEditorGroups', () => {
  it('groups intent sections around direct compatibility editing tasks', () => {
    const groups = buildPolicyIntentEditorGroups([
      { key: POLICY_INTENT_BUCKETS.IDENTITY, label: 'Belongs Here' },
      { key: POLICY_INTENT_BUCKETS.COMPATIBILITY, label: 'Helpful Matches' },
      { key: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, label: 'Hard Limits' },
      { key: POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS, label: 'Ask When Unsure' },
      { key: POLICY_INTENT_BUCKETS.BOOSTERS, label: 'Boosts' },
      { key: POLICY_INTENT_BUCKETS.EXCLUSIONS, label: 'Avoid' },
    ])

    expect(groups.map(group => group.id)).toEqual([
      POLICY_INTENT_EDITOR_GROUP_IDS.REVIEW_BEHAVIOR,
      POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_IDENTITY,
      POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_RULES,
      POLICY_INTENT_EDITOR_GROUP_IDS.CONFIDENCE_SUPPORT,
    ])
    expect(groups.map(group => group.targetId)).toEqual([
      'policy-builder-review-behavior',
      'policy-builder-destination-identity',
      'policy-builder-destination-rules',
      'policy-builder-confidence-support',
    ])
    expect(groups.map(group => ({ id: group.id, help: group.help }))).toEqual([
      {
        id: POLICY_INTENT_EDITOR_GROUP_IDS.REVIEW_BEHAVIOR,
        help: 'Choose the conditions that need review.',
      },
      {
        id: POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_IDENTITY,
        help: 'Add signals that identify this destination.',
      },
      {
        id: POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_RULES,
        help: 'Add helpful matches, hard limits, or avoid values.',
      },
      {
        id: POLICY_INTENT_EDITOR_GROUP_IDS.CONFIDENCE_SUPPORT,
        help: 'Add optional supporting signals.',
      },
    ])
    expect(groups.find(group => group.id === POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_RULES).sections.map(section => section.label))
      .toEqual(['Helpful Matches', 'Hard Limits', 'Avoid'])
    expect(groups.find(group => group.id === POLICY_INTENT_EDITOR_GROUP_IDS.REVIEW_BEHAVIOR).sections.map(section => section.label))
      .toEqual(['Ask When Unsure'])
  })

  it('omits missing sections without changing group targets', () => {
    const groups = buildPolicyIntentEditorGroups([
      { key: POLICY_INTENT_BUCKETS.IDENTITY, label: 'Belongs Here' },
    ])

    expect(groups.find(group => group.id === POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_IDENTITY).sections)
      .toEqual([{ key: POLICY_INTENT_BUCKETS.IDENTITY, label: 'Belongs Here' }])
    expect(groups.find(group => group.id === POLICY_INTENT_EDITOR_GROUP_IDS.DESTINATION_RULES).sections)
      .toEqual([])
  })
})
