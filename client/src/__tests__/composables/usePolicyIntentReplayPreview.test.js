/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import {
  buildPolicyIntentReplayPreviewPayload,
  usePolicyIntentReplayPreview,
} from '@/composables/usePolicyIntentReplayPreview'

function replayPreview() {
  return {
    schema_version: 1,
    mode: 'read_only_replay_preview',
    persistence_enabled: false,
    execution: {
      classification_run: false,
      ai_calls_enabled: false,
      provider_calls_enabled: false,
      arr_writes_enabled: false,
    },
    validation: { valid: true, errors: [] },
    impact_summary: {
      parity: 'matching',
      impact_level: 'none',
      changed_bucket_count: 0,
    },
    sample: {
      requested_limit: 5,
      returned_count: 1,
      readiness: 'ready',
      items: [{ sample_id: 1, title: 'Mulan', current_outcome: 'final_success' }],
    },
  }
}

describe('usePolicyIntentReplayPreview', () => {
  it('adds a bounded replay limit to preview payloads', () => {
    expect(buildPolicyIntentReplayPreviewPayload({ name: 'Family' }, 99)).toEqual({
      name: 'Family',
      replay_limit: 25,
    })
  })

  it('runs replay preview and normalizes the result', async () => {
    const previewPolicyIntentReplay = vi.fn().mockResolvedValue({ data: replayPreview() })
    const buildPayload = vi.fn(() => ({ name: 'Family Policy' }))

    const preview = usePolicyIntentReplayPreview({
      previewPolicyIntentReplay,
      buildPayload,
      replayLimit: 5,
    })

    await expect(preview.runPreview()).resolves.toMatchObject({
      sample: {
        readiness: 'ready',
        returned_count: 1,
      },
    })

    expect(previewPolicyIntentReplay).toHaveBeenCalledWith({
      name: 'Family Policy',
      replay_limit: 5,
    })
    expect(preview.notice.value).toEqual({
      tone: 'success',
      title: 'Replay samples are ready',
      message: 'Classifarr selected recent sanitized classifications without running AI, providers, or arr writes.',
    })
    expect(preview.samples.value[0].title).toBe('Mulan')
  })

  it('captures errors without clearing previous replay preview', async () => {
    const previewPolicyIntentReplay = vi
      .fn()
      .mockResolvedValueOnce({ data: replayPreview() })
      .mockRejectedValueOnce({ response: { data: { error: 'Invalid policy intent draft' } } })
    const buildPayload = vi.fn(() => ({ name: 'Family Policy' }))

    const preview = usePolicyIntentReplayPreview({
      previewPolicyIntentReplay,
      buildPayload,
    })

    await preview.runPreview()
    await preview.runPreview()

    expect(preview.preview.value.sample.readiness).toBe('ready')
    expect(preview.error.value).toBe('Invalid policy intent draft')
  })

  it('marks replay preview stale when the watched payload changes', async () => {
    const payload = ref({ name: 'Family Policy' })
    const previewPolicyIntentReplay = vi.fn().mockResolvedValue({ data: replayPreview() })
    const buildPayload = vi.fn(() => ({ ...payload.value }))

    const preview = usePolicyIntentReplayPreview({
      previewPolicyIntentReplay,
      buildPayload,
      payloadSource: computed(() => payload.value),
    })

    await preview.runPreview()
    expect(preview.isStale.value).toBe(false)

    payload.value = { name: 'Family Policy Updated' }
    await nextTick()

    expect(preview.isStale.value).toBe(true)
  })
})
