/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildPolicyIntentImpactPreviewNotice,
  normalizePolicyIntentImpactPreview,
  summarizePolicyIntentImpactChangedBuckets,
} from '@/utils/policyIntentImpactPreview'

describe('policyIntentImpactPreview utilities', () => {
  it('normalizes sanitized server previews without carrying raw draft content', () => {
    const normalized = normalizePolicyIntentImpactPreview({
      schema_version: '1',
      mode: 'non_persistent_preview',
      persistence_enabled: false,
      validation: { valid: true },
      legacy: {
        preset_count: '1',
        counts: { identity_signals: 1 },
        warning_count: 0,
        warning_reason_codes: ['partial_legacy_signal'],
      },
      native_draft: {
        present: true,
        draft_schema_version: 1,
        source: 'legacy_policy_builder',
        migration_state: 'legacy_compatible',
        preset_count: 1,
        counts: { identity_signals: 1 },
        presets: [{ should_not_survive: true }],
      },
      comparison: {
        parity: 'matching',
        impact_level: 'none',
        changed_buckets: [],
        bucket_deltas: [],
        reason_codes: [],
      },
      draft: { should_not_survive: true },
    })

    expect(normalized).toMatchObject({
      schema_version: 1,
      mode: 'non_persistent_preview',
      persistence_enabled: false,
      validation: { valid: true, errors: [] },
      legacy: {
        preset_count: 1,
        warning_count: 0,
      },
      native_draft: {
        present: true,
        draft_schema_version: 1,
        preset_count: 1,
      },
      comparison: {
        parity: 'matching',
        impact_level: 'none',
      },
    })
    expect(normalized).not.toHaveProperty('draft')
    expect(normalized.native_draft).not.toHaveProperty('presets')
  })

  it('builds warning copy and changed bucket summaries for high-impact drift', () => {
    const preview = normalizePolicyIntentImpactPreview({
      validation: { valid: true },
      legacy: { preset_count: 1, counts: {}, warning_count: 0 },
      native_draft: { present: true, preset_count: 1, counts: {} },
      comparison: {
        parity: 'different',
        impact_level: 'high',
        changed_buckets: ['strict_constraints'],
        bucket_deltas: [{
          bucket: 'strict_constraints',
          legacy_count: 1,
          native_count: 0,
          matching_signals: 0,
          removed_signals: 1,
          added_signals: 0,
          changed: true,
          reason_codes: ['signal_set_changed'],
        }],
        reason_codes: ['signal_set_changed'],
      },
    })

    expect(buildPolicyIntentImpactPreviewNotice(preview)).toEqual({
      tone: 'warning',
      title: 'High-impact intent drift detected',
      message: 'Belongs Here, Hard Limits, or Avoid signals differ from the legacy policy path. Review before saving.',
    })
    expect(summarizePolicyIntentImpactChangedBuckets(preview)).toEqual([{
      bucket: 'strict_constraints',
      label: 'Hard Limits',
      legacy_count: 1,
      native_count: 0,
      added_signals: 0,
      removed_signals: 1,
    }])
  })
})
