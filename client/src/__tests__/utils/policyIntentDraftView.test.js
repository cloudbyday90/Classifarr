/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { buildPolicyIntentDraft } from '@/utils/policyIntentDraftBridge'
import {
  POLICY_INTENT_DRAFT_VIEW_PROVENANCE,
  buildPolicyIntentViewFromDraft,
} from '@/utils/policyIntentDraftView'
import { POLICY_INTENT_BUCKETS } from '@/utils/policyIntentModel'

describe('policyIntentDraftView', () => {
  it('normalizes draft buckets into the editor intent view shape', () => {
    const draft = buildPolicyIntentDraft([{
      id: 14,
      preset_id: 14,
      name: 'Family',
      customSignals: {
        genres: {
          require_any: ['Family'],
          semantics: 'identity',
        },
        certifications: {
          mode: 'max',
          max: 'PG-13',
          constraint_mode: 'strict',
        },
      },
    }])

    const view = buildPolicyIntentViewFromDraft(draft)

    expect(view.summary).toEqual({
      preset_count: 1,
      counts: {
        [POLICY_INTENT_BUCKETS.IDENTITY]: 1,
        [POLICY_INTENT_BUCKETS.COMPATIBILITY]: 0,
        [POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]: 1,
        [POLICY_INTENT_BUCKETS.BOOSTERS]: 0,
        [POLICY_INTENT_BUCKETS.EXCLUSIONS]: 0,
      },
      provenance_counts: {
        [POLICY_INTENT_DRAFT_VIEW_PROVENANCE.COMPATIBILITY_FALLBACK]: 2,
      },
      warnings: [],
      readiness: {
        status: 'not_loaded',
        read_only: true,
        items: [],
      },
      observed_evidence: {
        status: 'not_loaded',
        read_only: true,
        items: [],
      },
    })
    expect(view[POLICY_INTENT_BUCKETS.IDENTITY]).toEqual([
      expect.objectContaining({
        role: POLICY_INTENT_BUCKETS.IDENTITY,
        preset_id: 14,
        preset_name: 'Family',
        signal_type: 'genres',
        semantics: 'identity',
        constraint_mode: 'advisory',
        values: { require_any: ['Family'] },
        display_values: [{ key: 'require_any', value: 'Family' }],
        source: 'legacy_custom_signals',
        provenance: {
          id: POLICY_INTENT_DRAFT_VIEW_PROVENANCE.COMPATIBILITY_FALLBACK,
          label: 'Policy override',
          help: 'Imported from existing policy-specific compatibility data.',
        },
        warnings: [],
      }),
    ])
    expect(view[POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS]).toEqual([
      expect.objectContaining({
        role: POLICY_INTENT_BUCKETS.STRICT_CONSTRAINTS,
        signal_type: 'certifications',
        constraint_mode: 'strict',
        values: { mode: 'max', max: 'PG-13' },
      }),
    ])
  })

  it('returns an empty editor view for missing drafts', () => {
    const view = buildPolicyIntentViewFromDraft(null)

    expect(view.summary.preset_count).toBe(0)
    expect(view[POLICY_INTENT_BUCKETS.IDENTITY]).toEqual([])
    expect(view.summary.readiness).toEqual({
      status: 'not_loaded',
      read_only: true,
      items: [],
    })
    expect(view.summary.observed_evidence).toEqual({
      status: 'not_loaded',
      read_only: true,
      items: [],
    })
  })

  it('keeps server readiness and observed evidence as read-only placeholders', () => {
    const view = buildPolicyIntentViewFromDraft(null, {
      readiness: {
        status: 'ready',
        items: [{ code: 'profile_loaded' }],
      },
      observedEvidence: {
        status: 'available',
        items: [{ type: 'genre', value: 'Animation' }],
      },
    })

    expect(view.summary.readiness).toEqual({
      status: 'ready',
      read_only: true,
      items: [{ code: 'profile_loaded' }],
    })
    expect(view.summary.observed_evidence).toEqual({
      status: 'available',
      read_only: true,
      items: [{ type: 'genre', value: 'Animation' }],
    })
  })

  it('does not expose raw legacy storage terms in the browser-facing view', () => {
    const draft = buildPolicyIntentDraft([{
      id: 21,
      name: 'Animation',
      customSignals: {
        genres: {
          require_any: ['Animation'],
        },
      },
    }])
    const view = buildPolicyIntentViewFromDraft(draft)
    const serializedView = JSON.stringify(view)

    expect(serializedView).not.toContain('customSignals')
    expect(serializedView).not.toContain('legacyCustomSignals')
    expect(serializedView).toContain('Policy override')
  })
})
