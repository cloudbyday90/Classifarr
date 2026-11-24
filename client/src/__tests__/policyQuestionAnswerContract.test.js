/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

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
  it.each([true, [7], '07', ' 7', '7e0', '7\n', 2147483648].map(value => [value]))(
    'does not construct a command for malformed destination %p', destination => {
      expect(buildPolicyQuestionAnswerPayload(policyQuestionAnswer(item()), 'confirm_destination', destination)).toBeNull()
    },
  )

  it('preserves the maximum destination as a numeric payload field', () => {
    expect(buildPolicyQuestionAnswerPayload(policyQuestionAnswer(item()), 'confirm_destination', '2147483647'))
      .toMatchObject({ destination_library_id: 2147483647 })
  })

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

  it('requires a supplied candidate History ID to match the card exactly', () => {
    const answer = item().policy_question_answer
    const bound = (id, candidateId) => policyQuestionAnswer(item({
      id, policy_question_answer: { ...answer, candidate_item: { classification_id: candidateId } },
    }))

    expect(bound('42', 42)).toMatchObject({ fingerprint: answer.fingerprint })
    expect(bound('9007199254740993', '9007199254740993')).toMatchObject({ fingerprint: answer.fingerprint })
    expect(bound('9007199254740993', '9007199254740992')).toBeNull()
    expect(bound('9007199254740992', Number.MAX_SAFE_INTEGER + 1)).toBeNull()
    expect(bound(42, null)).toBeNull()
  })
})
