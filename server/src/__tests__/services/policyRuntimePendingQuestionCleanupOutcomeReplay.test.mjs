/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  replayRecordedRuntimeQuestionAnswer,
} from '../../services/policyRuntimePendingQuestionCleanupOutcomeReplay.mjs';
import {
  POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS,
  buildPolicyRuntimeQuestionAnswerContract,
} from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';
import {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS,
} from '../../services/policyRuntimePendingQuestionCleanupPlan.mjs';

function question() {
  return normalizePolicyRuntimeQuestion({
    metadata: { media_type: 'movie' },
    libraries: [{ id: 7, name: 'Family Movies', media_type: 'movie', is_active: true }],
    policyResult: { ranked: [{ library_id: 7, score: 88 }] },
  });
}

function classification(policyQuestion) {
  const base = {
    id: 91,
    title: 'Example Movie',
    year: 2026,
    media_type: 'movie',
  };
  const contract = buildPolicyRuntimeQuestionAnswerContract({
    classification: base,
    question: policyQuestion,
  });
  return {
    ...base,
    policy_question: policyQuestion,
    metadata: {
      classification_details: {
        outcome_link: {
          runtime_question_answer: {
            contract_version: contract.version,
            contract_fingerprint: contract.fingerprint,
            action_id: POLICY_RUNTIME_QUESTION_ANSWER_ACTION_IDS.CONFIRM_DESTINATION,
            destination_library_id: 7,
          },
        },
      },
    },
  };
}

describe('policyRuntimePendingQuestionCleanupOutcomeReplay', () => {
  test('replays only a currently valid structured answer and records no learning patch', async () => {
    const policyQuestion = question();
    const row = classification(policyQuestion);
    const client = {
      query: jest.fn(async sql => {
        if (sql.includes('FROM libraries')) {
          return { rows: [{ id: 7, name: 'Family Movies', media_type: 'movie', is_active: true }] };
        }
        return { rows: [] };
      }),
    };
    const outcomeService = { recordOutcome: jest.fn().mockResolvedValue({ updated: true }) };

    const result = await replayRecordedRuntimeQuestionAnswer({
      client,
      classification: row,
      actorId: 'user:7',
      outcomeService,
    });

    expect(result).toEqual({ resolved: true, retryRequired: false, reasonId: null });
    expect(outcomeService.recordOutcome).toHaveBeenCalledWith(91, expect.objectContaining({
      type: 'resolved',
      source: 'pending_question_cleanup',
      actor: 'user:7',
      final_library_id: 7,
      runtime_question_answer: expect.objectContaining({ action_id: 'confirm_destination' }),
    }), { client });
    expect(JSON.stringify(outcomeService.mock?.calls || outcomeService.recordOutcome.mock.calls))
      .not.toContain('learning');
  });

  test('does not resolve a stale answer and leaves the caller to queue a fresh runtime evaluation', async () => {
    const policyQuestion = question();
    const row = classification(policyQuestion);
    row.metadata.classification_details.outcome_link.runtime_question_answer.contract_fingerprint = 'stale';
    const client = { query: jest.fn() };

    const result = await replayRecordedRuntimeQuestionAnswer({
      client,
      classification: row,
      actorId: 'user:7',
    });

    expect(result).toEqual({
      resolved: false,
      retryRequired: true,
      reasonId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
    });
    expect(client.query).not.toHaveBeenCalled();
  });
});
