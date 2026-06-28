/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { usePolicyIntentImpactPreview } from '@/composables/usePolicyIntentImpactPreview'

function matchingPreview() {
  return {
    validation: { valid: true, errors: [] },
    legacy: {
      preset_count: 1,
      counts: { identity_signals: 1 },
      warning_count: 0,
      warning_reason_codes: [],
    },
    native_draft: {
      present: true,
      draft_schema_version: 1,
      source: 'legacy_policy_builder',
      migration_state: 'legacy_compatible',
      preset_count: 1,
      counts: { identity_signals: 1 },
    },
    comparison: {
      parity: 'matching',
      impact_level: 'none',
      changed_buckets: [],
      bucket_deltas: [],
      reason_codes: [],
    },
  }
}

describe('usePolicyIntentImpactPreview', () => {
  it('runs the preview request and normalizes the result', async () => {
    const previewPolicyIntentImpact = vi.fn().mockResolvedValue({ data: matchingPreview() })
    const buildPayload = vi.fn(() => ({ name: 'Family Policy' }))

    const preview = usePolicyIntentImpactPreview({
      previewPolicyIntentImpact,
      buildPayload,
    })

    await expect(preview.runPreview()).resolves.toMatchObject({
      comparison: {
        parity: 'matching',
        impact_level: 'none',
      },
    })
    await nextTick()

    expect(previewPolicyIntentImpact).toHaveBeenCalledWith({ name: 'Family Policy' })
    expect(preview.error.value).toBeNull()
    expect(preview.notice.value).toEqual({
      tone: 'success',
      title: 'Intent preview matches saved policy behavior',
      message: 'The native intent draft and legacy preset path express the same policy structure.',
    })
  })

  it('captures bounded API errors without clearing a previous preview', async () => {
    const previewPolicyIntentImpact = vi
      .fn()
      .mockResolvedValueOnce({ data: matchingPreview() })
      .mockRejectedValueOnce({ response: { data: { error: 'Invalid policy intent draft' } } })
    const buildPayload = vi.fn(() => ({ name: 'Family Policy' }))

    const preview = usePolicyIntentImpactPreview({
      previewPolicyIntentImpact,
      buildPayload,
    })

    await preview.runPreview()
    await preview.runPreview()

    expect(preview.preview.value).toMatchObject({
      comparison: {
        parity: 'matching',
      },
    })
    expect(preview.error.value).toBe('Invalid policy intent draft')
  })
})
