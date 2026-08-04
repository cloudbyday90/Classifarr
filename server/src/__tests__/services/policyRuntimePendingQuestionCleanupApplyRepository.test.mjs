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
  FRESH_RUNTIME_EVALUATION_ACTION_IDS,
  FRESH_RUNTIME_EVALUATION_PENDING_REASON,
  lockPendingQuestionCleanupClassification,
  loadPendingQuestionCleanupFreshRuntimeReplay,
  queuePendingQuestionCleanupFreshRuntimeEvaluation,
} from '../../services/policyRuntimePendingQuestionCleanupApplyRepository.mjs';

describe('policyRuntimePendingQuestionCleanupApplyRepository', () => {
  test('locks the current classification and includes the cleanup retry marker', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 14 }] });

    const row = await lockPendingQuestionCleanupClassification({
      client: { query },
      classificationId: 14,
    });

    expect(row).toEqual({ id: 14 });
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/ch\.pending_reason/), [14]);
    expect(query.mock.calls[0][0]).toMatch(/FOR UPDATE/);
  });

  test('finds only an existing bounded fresh-runtime audit receipt for a rerun', async () => {
    const replay = {
      action_id: 'mark_stale_require_retry',
      reason_ids: ['pending_question_cleanup_missing_policy_question'],
      source_version: 'policy.runtime_pending_question_cleanup.v1',
      result_status_id: 'queued_fresh_runtime_evaluation',
      replay_receipt: '00000000-0000-4000-8000-000000000014',
    };
    const query = jest.fn().mockResolvedValue({ rows: [replay] });

    const row = await loadPendingQuestionCleanupFreshRuntimeReplay({
      client: { query },
      classificationId: 14,
    });

    expect(row).toEqual(replay);
    expect(query).toHaveBeenCalledWith(expect.stringMatching(
      /result_status_id = 'queued_fresh_runtime_evaluation'/,
    ), [
      14,
      'policy.runtime_pending_question_cleanup.v1',
      FRESH_RUNTIME_EVALUATION_ACTION_IDS,
    ]);
  });

  test('clears unsafe answer material and queues a fresh evaluation through one transaction client', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const client = { query };

    await queuePendingQuestionCleanupFreshRuntimeEvaluation({
      client,
      classificationId: 14,
    });

    expect(query).toHaveBeenNthCalledWith(1,
      'DELETE FROM clarification_responses WHERE classification_id = $1',
      [14],
    );
    expect(query).toHaveBeenNthCalledWith(2, expect.stringMatching(
      /status = 'pending_retry'[\s\S]*policy_question = NULL[\s\S]*clarification_response = NULL/,
    ), [14, FRESH_RUNTIME_EVALUATION_PENDING_REASON]);
  });
});
