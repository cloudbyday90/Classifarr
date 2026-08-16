/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { usePolicyNativeIntentPurposeChange } from '@/composables/usePolicyNativeIntentPurposeChange'

function purposeRead(revision = 3, term = 'Animation') {
  return {
    version: 'policy.native_intent_purpose_change_read.v1',
    statusId: 'native_intent_purpose_change_available',
    policyId: 17,
    revision,
    changeCommand: {
      command_id: 'update_purpose',
      values: [{
        signal_type: 'genres',
        operator: 'require_any',
        values: { require_any: [term] },
        constraint_mode: 'advisory',
        semantics: 'identity',
      }],
    },
    authority: {
      source: 'server_owned_native_intent',
      purposeChangeAllowed: true,
      browserAuthorityAccepted: false,
    },
    compatibilityDataExposed: false,
    aiDataExposed: false,
    routingDataExposed: false,
    learningDataExposed: false,
  }
}

describe('usePolicyNativeIntentPurposeChange', () => {
  it('loads server-owned authority, preflights the exact command, applies it, and reloads the new revision', async () => {
    const loadPurposeChangeRequest = vi.fn()
      .mockResolvedValueOnce(purposeRead(3, 'Animation'))
      .mockResolvedValueOnce(purposeRead(4, 'Comedy'))
    const preflightPurposeChangeRequest = vi.fn().mockResolvedValue({
      data: {
        advisory: true,
        commandId: 'update_purpose',
        expectedRevision: 3,
        currentRevision: 3,
      },
    })
    const applyPurposeChangeRequest = vi.fn().mockResolvedValue({
      data: {
        statusId: 'applied',
        change: { applied: true, newIntentVersion: 4 },
      },
    })
    const purposeChange = usePolicyNativeIntentPurposeChange({
      loadPurposeChangeRequest,
      preflightPurposeChangeRequest,
      applyPurposeChangeRequest,
      createIdempotencyKey: () => '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    })

    await expect(purposeChange.load(17)).resolves.toBe(true)
    expect(purposeChange.startEditing()).toBe(true)
    await expect(purposeChange.runPreflight(17)).resolves.toBe(true)
    await expect(purposeChange.apply(17)).resolves.toBe(true)

    expect(preflightPurposeChangeRequest).toHaveBeenCalledWith(17, 3, {
      command_id: 'update_purpose',
      values: expect.any(Array),
    })
    expect(applyPurposeChangeRequest).toHaveBeenCalledWith(
      17,
      3,
      { command_id: 'update_purpose', values: expect.any(Array) },
      { idempotencyKey: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777' },
    )
    expect(purposeChange.currentRevision.value).toBe(4)
    expect(purposeChange.draftRules.value[0].values).toEqual({ require_any: ['Comedy'] })
  })

  it('reloads the server-owned authority on a stale revision instead of retaining the stale draft', async () => {
    const loadPurposeChangeRequest = vi.fn()
      .mockResolvedValueOnce(purposeRead(3, 'Animation'))
      .mockResolvedValueOnce(purposeRead(4, 'Comedy'))
    const purposeChange = usePolicyNativeIntentPurposeChange({
      loadPurposeChangeRequest,
      applyPurposeChangeRequest: vi.fn().mockRejectedValue({
        response: { data: { code: 'POLICY_NATIVE_INTENT_CHANGE_STALE_REVISION' } },
      }),
      createIdempotencyKey: () => '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
    })

    await purposeChange.load(17)
    purposeChange.startEditing()
    await expect(purposeChange.apply(17)).resolves.toBe(false)

    expect(purposeChange.editing.value).toBe(true)
    expect(purposeChange.currentRevision.value).toBe(4)
    expect(purposeChange.draftRules.value[0].values).toEqual({ require_any: ['Comedy'] })
    expect(purposeChange.applyError.value).toContain('revision changed')
  })

  it('reuses the same in-memory key after an ambiguous request failure and clears it after a committed replay', async () => {
    const loadPurposeChangeRequest = vi.fn()
      .mockResolvedValueOnce(purposeRead(3, 'Animation'))
      .mockResolvedValueOnce(purposeRead(4, 'Comedy'))
    const applyPurposeChangeRequest = vi.fn()
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce({
        data: {
          statusId: 'applied',
          change: { applied: true, replayed: true, newIntentVersion: 4 },
        },
      })
    const createIdempotencyKey = vi.fn(() => '6fe3d170-9390-4ec5-95f7-42ad6f8ec777')
    const purposeChange = usePolicyNativeIntentPurposeChange({
      loadPurposeChangeRequest,
      applyPurposeChangeRequest,
      createIdempotencyKey,
    })

    await purposeChange.load(17)
    purposeChange.startEditing()
    await expect(purposeChange.apply(17)).resolves.toBe(false)
    await expect(purposeChange.apply(17)).resolves.toBe(true)

    expect(createIdempotencyKey).toHaveBeenCalledTimes(1)
    expect(applyPurposeChangeRequest.mock.calls.map(call => call[3])).toEqual([
      { idempotencyKey: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777' },
      { idempotencyKey: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777' },
    ])
    expect(purposeChange.feedback.value).toContain('earlier declared-purpose change was confirmed')
  })
})
