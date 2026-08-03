/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS,
  POLICY_AUTHORING_ACTION_IDS,
  buildPolicyAuthoringActionFailureFeedback,
} from '@/utils/policyAuthoringActionFeedback'

describe('policyAuthoringActionFeedback', () => {
  it('classifies admitted request rejection without rendering server error text', () => {
    const feedback = buildPolicyAuthoringActionFailureFeedback({
      actionId: POLICY_AUTHORING_ACTION_IDS.CREATE_NATIVE_POLICY,
      error: {
        response: {
          status: 422,
          data: {
            code: 'POLICY_NATIVE_INTENT_CREATE_IDEMPOTENCY_KEY_REUSED',
            error: 'Internal validation detail that must not be rendered.',
          },
        },
      },
    })

    expect(feedback).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.REJECTED,
      retryable: false,
    })
    expect(feedback.message).not.toContain('Internal validation detail')
  })

  it('separates stale conflicts, unavailable authorization, and retryable transport failures', () => {
    expect(buildPolicyAuthoringActionFailureFeedback({
      error: { response: { status: 409, data: { error: 'private conflict detail' } } },
    })).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.STALE,
      retryable: false,
    })

    expect(buildPolicyAuthoringActionFailureFeedback({
      error: { response: { status: 401, data: { error: 'private session detail' } } },
    })).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.UNAVAILABLE,
      retryable: false,
    })

    expect(buildPolicyAuthoringActionFailureFeedback({
      error: new Error('network implementation detail'),
    })).toMatchObject({
      statusId: POLICY_AUTHORING_ACTION_FEEDBACK_STATUS_IDS.RETRYABLE_ERROR,
      retryable: true,
    })
  })
})
