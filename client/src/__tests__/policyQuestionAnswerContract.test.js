import { describe, expect, it } from 'vitest'

import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  buildPolicyQuestionAnswerPayload,
  policyQuestionAnswer,
} from '@/utils/policyQuestionAnswerContract'

function item(overrides = {}) {
  return {
    policy_question_answer: {
      version: 'policy.runtime_question_answer.v1',
      fingerprint: 'server-owned-fingerprint',
      candidate_destinations: [{ library_id: 7, library_name: 'Family Movies' }],
      allowed_actions: [
        {
          id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
          available: true,
          destination_required: true,
        },
        {
          id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.MARK_EXACT_ITEM_MEMORY,
          available: false,
          destination_required: true,
        },
      ],
    },
    ...overrides,
  }
}

describe('policyQuestionAnswerContract', () => {
  it('serializes only the server contract version, fingerprint, action ID, and destination ID', () => {
    const payload = buildPolicyQuestionAnswerPayload(
      policyQuestionAnswer(item()),
      POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
      '7',
    )

    expect(payload).toEqual({
      contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'server-owned-fingerprint',
      action_id: 'confirm_destination',
      destination_library_id: 7,
    })
    expect(payload).not.toHaveProperty('selected_option')
  })

  it('does not serialize unavailable learning actions or malformed server contracts', () => {
    expect(buildPolicyQuestionAnswerPayload(
      policyQuestionAnswer(item()),
      POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.MARK_EXACT_ITEM_MEMORY,
      7,
    )).toBeNull()

    expect(policyQuestionAnswer(item({
      policy_question_answer: { version: 'unknown', fingerprint: 'x' },
    }))).toBeNull()
  })
})
