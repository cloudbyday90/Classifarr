/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import {
  fingerprintPolicyIntentPreviewPayload,
  usePolicyIntentImpactPreview,
} from '@/composables/usePolicyIntentImpactPreview'

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
  it('creates stable fingerprints independent of object key order', () => {
    expect(fingerprintPolicyIntentPreviewPayload({
      b: 2,
      a: { d: 4, c: 3 },
    })).toBe(fingerprintPolicyIntentPreviewPayload({
      a: { c: 3, d: 4 },
      b: 2,
    }))
  })

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

  it('marks a preview stale when the watched payload changes after preview', async () => {
    const payload = ref({ name: 'Family Policy', presets: [{ preset_id: 5, weight: 1 }] })
    const previewPolicyIntentImpact = vi.fn().mockResolvedValue({ data: matchingPreview() })
    const buildPayload = vi.fn(() => ({ ...payload.value }))

    const preview = usePolicyIntentImpactPreview({
      previewPolicyIntentImpact,
      buildPayload,
      payloadSource: computed(() => payload.value),
    })

    await preview.runPreview()
    expect(preview.isStale.value).toBe(false)

    payload.value = { name: 'Family Policy Updated', presets: [{ preset_id: 5, weight: 1 }] }
    await nextTick()

    expect(preview.isStale.value).toBe(true)

    await preview.runPreview()
    expect(preview.isStale.value).toBe(false)
  })
})
