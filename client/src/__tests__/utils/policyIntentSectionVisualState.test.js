/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import {
  buildPolicyIntentSectionCompletion,
  buildPolicyIntentSectionNextAction,
  buildPolicyIntentSectionWarnings,
} from '@/utils/policyIntentSectionVisualState'

describe('policyIntentSectionVisualState', () => {
  it('builds weak-section warnings from deterministic section context', () => {
    const sectionMap = {
      [POLICY_INTENT_BUCKETS.COMPATIBILITY]: [{ displayText: 'Helpful match: Comedy' }],
      [POLICY_INTENT_BUCKETS.BOOSTERS]: [{ displayText: 'Confidence boost: Adventure' }],
    }

    expect(buildPolicyIntentSectionWarnings(POLICY_INTENT_BUCKETS.IDENTITY, [], sectionMap)).toEqual([
      expect.objectContaining({
        code: 'missing_identity',
        severity: 'warning',
        consequence: 'Without identity evidence, broad hints and RAG neighbors are more likely to force manual review.',
      }),
    ])
    expect(buildPolicyIntentSectionWarnings(
      POLICY_INTENT_BUCKETS.COMPATIBILITY,
      sectionMap[POLICY_INTENT_BUCKETS.COMPATIBILITY],
      sectionMap,
    )).toEqual([
      expect.objectContaining({
        code: 'compatibility_without_identity',
        message: 'Helpful matches cannot decide alone. Add a belongs-here signal.',
        consequence: 'Helpful evidence can support a destination, but it should not be the strongest reason to classify there.',
      }),
    ])
    expect(buildPolicyIntentSectionWarnings(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, [], sectionMap)).toEqual([
      expect.objectContaining({
        code: 'missing_hard_limit',
        severity: 'info',
        consequence: 'Without a hard limit, mature or unrated items rely on weaker evidence before review is triggered.',
      }),
    ])
    expect(buildPolicyIntentSectionWarnings(
      POLICY_INTENT_BUCKETS.BOOSTERS,
      sectionMap[POLICY_INTENT_BUCKETS.BOOSTERS],
      sectionMap,
    )).toEqual([
      expect.objectContaining({
        code: 'boosters_without_identity',
        severity: 'warning',
        consequence: 'Boosts should improve confidence after a fit is established, not create the fit by themselves.',
      }),
    ])
    expect(buildPolicyIntentSectionWarnings(POLICY_INTENT_BUCKETS.EXCLUSIONS, [], sectionMap)).toEqual([
      expect.objectContaining({
        code: 'missing_exclusions',
        severity: 'info',
        consequence: 'Avoid ratings help Classifarr lower confidence before an item reaches the wrong destination.',
      }),
    ])
  })

  it('suppresses cross-section warnings when required context exists', () => {
    expect(buildPolicyIntentSectionWarnings(
      POLICY_INTENT_BUCKETS.COMPATIBILITY,
      [{ displayText: 'Helpful match: Comedy' }],
      {
        [POLICY_INTENT_BUCKETS.IDENTITY]: [{ displayText: 'Belongs here: Family' }],
      },
    )).toEqual([])

    expect(buildPolicyIntentSectionWarnings(
      POLICY_INTENT_BUCKETS.EXCLUSIONS,
      [],
      {
        [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [{ displayText: 'Maximum rating: PG-13' }],
      },
    )).toEqual([])
  })

  it('builds section completion badges from warnings and configured entries', () => {
    expect(buildPolicyIntentSectionCompletion(
      POLICY_INTENT_BUCKETS.IDENTITY,
      [],
      [{ code: 'missing_identity', severity: 'warning' }],
    )).toEqual({
      status: 'needs_identity',
      tone: 'warning',
      label: 'Needs identity',
      description: 'Add a belongs-here signal before relying on this policy.',
    })

    expect(buildPolicyIntentSectionCompletion(
      POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
      [],
      [{ code: 'missing_hard_limit', severity: 'info' }],
    )).toMatchObject({
      status: 'advisory',
      tone: 'info',
      label: 'Advisory',
    })

    expect(buildPolicyIntentSectionCompletion(
      POLICY_INTENT_BUCKETS.BOOSTERS,
      [{ displayText: 'Confidence boost: Adventure' }],
      [],
    )).toMatchObject({
      status: 'configured',
      tone: 'success',
      label: 'Configured',
    })

    expect(buildPolicyIntentSectionCompletion(POLICY_INTENT_BUCKETS.BOOSTERS, [], [])).toMatchObject({
      status: 'optional',
      tone: 'neutral',
      label: 'Optional',
    })
  })

  it('builds section next actions from completion state', () => {
    expect(buildPolicyIntentSectionNextAction(POLICY_INTENT_BUCKETS.IDENTITY, {
      status: 'needs_identity',
    })).toBe('Next: add a belongs-here genre that clearly defines this destination.')

    expect(buildPolicyIntentSectionNextAction(POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS, {
      status: 'advisory',
    })).toBe('Next: add a maximum rating if this library needs a hard maturity boundary.')

    expect(buildPolicyIntentSectionNextAction(POLICY_INTENT_BUCKETS.EXCLUSIONS, {
      status: 'advisory',
    })).toBe('Next: add avoid ratings if specific certifications should reduce confidence.')

    expect(buildPolicyIntentSectionNextAction(POLICY_INTENT_BUCKETS.BOOSTERS, {
      status: 'optional',
    })).toBe('Next: add boosts only for signals that should raise confidence after a fit is established.')

    expect(buildPolicyIntentSectionNextAction(POLICY_INTENT_BUCKETS.IDENTITY, {
      status: 'configured',
    })).toBe('Next: add helpful matches only if they support this identity without replacing it.')
  })
})
