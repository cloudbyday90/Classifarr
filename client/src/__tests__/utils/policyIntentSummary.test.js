/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'
import { buildPolicyIntentSummary } from '@/utils/policyIntentSummary'

describe('policyIntentSummary', () => {
  it('builds product-facing sections from the intent view', () => {
    const summary = buildPolicyIntentSummary({
      [POLICY_INTENT_BUCKETS.IDENTITY]: [{
        preset_name: 'Family',
        signal_type: 'genres',
        values: { require_any: ['Family'] },
      }],
      [POLICY_INTENT_BUCKETS.COMPATIBILITY]: [{
        preset_name: 'Movies',
        signal_type: 'genres',
        values: { require_any: ['Adventure'] },
      }],
      [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [{
        preset_name: 'Family',
        signal_type: 'certifications',
        values: { mode: 'max', max: 'PG-13' },
      }],
      [POLICY_INTENT_BUCKETS.BOOSTERS]: [{
        preset_name: 'Family',
        signal_type: 'keywords',
        values: { prefer: ['princess'] },
      }],
      [POLICY_INTENT_BUCKETS.EXCLUSIONS]: [{
        preset_name: 'Family',
        signal_type: 'certifications',
        values: { exclude: ['R'] },
      }],
      [POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS]: [{
        preset_name: 'Family',
        signal_type: 'review_triggers',
        values: { when_any: ['evidence_missing'] },
      }],
      summary: {
        preset_count: 2,
      },
    })

    expect(summary.has_warnings).toBe(false)
    expect(summary.sections.find(section => section.key === 'purpose').items).toEqual([
      expect.objectContaining({
        text: 'genres: Family',
        source: 'Family',
      }),
    ])
    expect(summary.sections.find(section => section.key === 'hard_limits').items).toEqual([
      expect.objectContaining({ text: 'certifications: max PG-13' }),
      expect.objectContaining({ text: 'certifications: R' }),
    ])
    expect(summary.sections.find(section => section.key === 'helpful_hints').items).toEqual([
      expect.objectContaining({ text: 'genres: Adventure' }),
      expect.objectContaining({ text: 'keywords: princess' }),
    ])
    expect(summary.sections.find(section => section.key === 'review_triggers').items).toEqual([
      expect.objectContaining({
        text: 'review_triggers: Evidence is missing',
        source: 'Family',
      }),
    ])
  })

  it('adds deterministic review triggers for weak intent', () => {
    const summary = buildPolicyIntentSummary({
      [POLICY_INTENT_BUCKETS.IDENTITY]: [],
      [POLICY_INTENT_BUCKETS.COMPATIBILITY]: [{
        preset_name: 'Comedy',
        signal_type: 'genres',
        values: { require_any: ['Comedy'] },
      }],
      [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: [],
      [POLICY_INTENT_BUCKETS.BOOSTERS]: [],
      [POLICY_INTENT_BUCKETS.EXCLUSIONS]: [],
      [POLICY_INTENT_BUCKETS.REVIEW_TRIGGERS]: [],
      summary: {
        preset_count: 1,
      },
    })

    const reviewItems = summary.sections.find(section => section.key === 'review_triggers').items

    expect(summary.has_warnings).toBe(true)
    expect(reviewItems.map(item => item.text)).toEqual([
      'No belongs-here signals are defined yet.',
      'No hard limits or avoid rules are defined.',
      'Helpful matches cannot decide the destination without belongs-here signals.',
    ])
  })
})
