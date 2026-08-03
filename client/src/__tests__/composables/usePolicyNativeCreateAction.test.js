/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it, vi } from 'vitest'
import { usePolicyNativeCreateAction } from '@/composables/usePolicyNativeCreateAction'
import {
  POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS,
} from '@/utils/policyAuthoringActionFeedback'

const policyData = {
  library_id: 7,
  name: 'Family Movies Policy',
  native_intent_establishment: {
    declared_intent: {
      purpose: [{ signal_type: 'genres', values: { require_any: ['Family'] } }],
    },
  },
}

const confirmedResponse = {
  data: {
    id: 93,
    native_intent_establishment: {
      statusId: 'initial_intent_established',
    },
  },
}

function createAction(overrides = {}) {
  return usePolicyNativeCreateAction({
    createPolicyRequest: vi.fn().mockResolvedValue(confirmedResponse),
    createIdempotencyKey: vi.fn(() => 'ab4fd5b5-b2b7-43d5-8099-bc0db5aee3b4'),
    buildAttemptFingerprint: vi.fn(() => 'attempt-fingerprint'),
    isConfirmedResponse: vi.fn(() => true),
    ...overrides,
  })
}

describe('usePolicyNativeCreateAction', () => {
  it('submits the native contract with one caller-stable idempotency key and reports success only after confirmation', async () => {
    const createPolicyRequest = vi.fn().mockResolvedValue(confirmedResponse)
    const createIdempotencyKey = vi.fn(() => 'ab4fd5b5-b2b7-43d5-8099-bc0db5aee3b4')
    const action = createAction({ createPolicyRequest, createIdempotencyKey })

    await expect(action.create(policyData)).resolves.toMatchObject({
      accepted: true,
      response: confirmedResponse,
      feedback: {
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.SUCCEEDED,
      },
    })

    expect(createPolicyRequest).toHaveBeenCalledWith(policyData, {
      idempotencyKey: 'ab4fd5b5-b2b7-43d5-8099-bc0db5aee3b4',
    })
    expect(createIdempotencyKey).toHaveBeenCalledTimes(1)
  })

  it('does not issue a duplicate request while the action is pending', async () => {
    let resolveRequest
    const createPolicyRequest = vi.fn(() => new Promise(resolve => {
      resolveRequest = resolve
    }))
    const action = createAction({ createPolicyRequest })

    const firstAttempt = action.create(policyData)
    const duplicateAttempt = await action.create(policyData)

    expect(action.pending.value).toBe(true)
    expect(createPolicyRequest).toHaveBeenCalledTimes(1)
    expect(duplicateAttempt.accepted).toBe(false)

    resolveRequest(confirmedResponse)
    await expect(firstAttempt).resolves.toMatchObject({ accepted: true })
  })

  it('reports stale conflicts without exposing server details', async () => {
    const action = createAction({
      createPolicyRequest: vi.fn().mockRejectedValue({
        response: {
          status: 409,
          data: { error: 'The internal lock owner is still running.' },
        },
      }),
    })

    await expect(action.create(policyData)).resolves.toMatchObject({
      accepted: false,
      feedback: {
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
      },
    })
    expect(action.feedback.value.message).not.toContain('internal lock owner')
  })

  it('keeps retryable failures on the same request identity and refuses unconfirmed results', async () => {
    const createPolicyRequest = vi.fn()
      .mockRejectedValueOnce(new Error('network implementation detail'))
      .mockResolvedValueOnce({ data: { id: 93 } })
    const action = createAction({
      createPolicyRequest,
      isConfirmedResponse: vi.fn(() => false),
    })

    await expect(action.create(policyData)).resolves.toMatchObject({
      feedback: {
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
        retryable: true,
      },
    })
    await expect(action.create(policyData)).resolves.toMatchObject({
      feedback: {
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
        retryable: true,
      },
    })

    expect(createPolicyRequest.mock.calls.map(([, options]) => options.idempotencyKey))
      .toEqual([
        'ab4fd5b5-b2b7-43d5-8099-bc0db5aee3b4',
        'ab4fd5b5-b2b7-43d5-8099-bc0db5aee3b4',
      ])
    expect(action.feedback.value.message).not.toContain('network implementation detail')
  })

  it('does not issue a request when secure idempotency capability is unavailable', async () => {
    const createPolicyRequest = vi.fn()
    const action = createAction({
      createPolicyRequest,
      createIdempotencyKey: () => {
        throw new Error('secure random source unavailable')
      },
    })

    await expect(action.create(policyData)).resolves.toMatchObject({
      accepted: false,
      feedback: {
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      },
    })
    expect(createPolicyRequest).not.toHaveBeenCalled()
  })

  it('does not issue a request when idempotency-key generation returns no usable key', async () => {
    const createPolicyRequest = vi.fn()
    const action = createAction({
      createPolicyRequest,
      createIdempotencyKey: () => '   ',
    })

    await expect(action.create(policyData)).resolves.toMatchObject({
      accepted: false,
      feedback: {
        statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      },
    })
    expect(createPolicyRequest).not.toHaveBeenCalled()
  })
})
