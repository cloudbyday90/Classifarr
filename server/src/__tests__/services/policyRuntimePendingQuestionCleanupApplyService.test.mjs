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
  PolicyRuntimePendingQuestionCleanupApplyService,
  RESULT_STATUS_IDS,
} from '../../services/policyRuntimePendingQuestionCleanupApplyService.mjs';
import {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS,
} from '../../services/policyRuntimePendingQuestionCleanupPlan.mjs';

function answerMetadata() {
  return {
    classification_details: {
      outcome_link: {
        runtime_question_answer: {
          contract_version: 'policy.runtime_question_answer.v1',
          contract_fingerprint: 'current-fingerprint',
          action_id: 'confirm_destination',
        },
      },
    },
  };
}

function createService({ rows = new Map(), replayResult = null } = {}) {
  const lockClassification = jest.fn(async ({ classificationId }) => rows.get(classificationId) || null);
  const loadCurrentContext = jest.fn(async () => ({
    activeLibraryIds: [],
    currentContextVersion: null,
    contextEvaluated: true,
  }));
  const queueFreshRuntimeEvaluation = jest.fn(async () => undefined);
  const replayOutcome = jest.fn(async () => replayResult || {
    resolved: false,
    reasonId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
  });
  const insertAuditRecord = jest.fn(async ({ replayReceipt }) => ({ replay_receipt: replayReceipt }));
  const db = {
    withTransaction: jest.fn(async work => work({ query: jest.fn() })),
  };
  let receiptNumber = 0;
  const service = new PolicyRuntimePendingQuestionCleanupApplyService({
    db,
    lockClassification,
    loadCurrentContext,
    queueFreshRuntimeEvaluation,
    replayOutcome,
    insertAuditRecord,
    createReceipt: () => `00000000-0000-4000-8000-${String(++receiptNumber).padStart(12, '0')}`,
  });

  return {
    service,
    db,
    lockClassification,
    loadCurrentContext,
    queueFreshRuntimeEvaluation,
    replayOutcome,
    insertAuditRecord,
  };
}

describe('PolicyRuntimePendingQuestionCleanupApplyService', () => {
  test('locks selected records in a stable order, re-runs the plan, queues stale work, and writes bounded audits', async () => {
    const { service, lockClassification, queueFreshRuntimeEvaluation, insertAuditRecord } = createService({
      rows: new Map([[8, {
        id: 8,
        status: 'awaiting_decision',
        policy_question: null,
        metadata: {},
        clarification_response: null,
      }], [3, {
        id: 3,
        status: 'awaiting_decision',
        policy_question: null,
        metadata: {},
        clarification_response: null,
      }]]),
    });

    const result = await service.run({ classificationIds: [8, 3], actorId: 'user:42' });

    expect(lockClassification.mock.calls.map(([input]) => input.classificationId)).toEqual([3, 8]);
    expect(queueFreshRuntimeEvaluation).toHaveBeenCalledTimes(2);
    expect(insertAuditRecord).toHaveBeenCalledTimes(2);
    expect(insertAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
      actorId: 'user:42',
      resultStatusId: RESULT_STATUS_IDS.QUEUED_FRESH_RUNTIME_EVALUATION,
      reasonIds: [POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_POLICY_QUESTION],
      sourceVersion: 'policy.runtime_pending_question_cleanup.v1',
    }));
    expect(result.summary).toMatchObject({
      requestedRecordCount: 2,
      queued_fresh_runtime_evaluation: 2,
    });
    expect(result.records[0]).not.toHaveProperty('policyQuestion');
    expect(result.records[0]).not.toHaveProperty('metadata');
    expect(result.records[0]).not.toHaveProperty('clarificationResponse');
  });

  test('replays a proven current runtime answer outcome-only without queuing or learning', async () => {
    const { service, queueFreshRuntimeEvaluation, replayOutcome, insertAuditRecord } = createService({
      rows: new Map([[12, {
        id: 12,
        status: 'awaiting_decision',
        metadata: answerMetadata(),
        policy_question: {},
        clarification_response: null,
      }]]),
      replayResult: { resolved: true, reasonId: null },
    });

    const result = await service.run({ classificationIds: [12], actorId: 'user:1' });

    expect(replayOutcome).toHaveBeenCalledWith(expect.objectContaining({
      classification: expect.objectContaining({ id: 12 }),
      actorId: 'user:1',
    }));
    expect(queueFreshRuntimeEvaluation).not.toHaveBeenCalled();
    expect(insertAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.RESOLVE_OUTCOME_ONLY,
      resultStatusId: RESULT_STATUS_IDS.RESOLVED_OUTCOME_ONLY,
    }));
    expect(result).toMatchObject({
      sideEffects: { learningWritten: false },
      summary: { resolved_outcome_only: 1 },
    });
  });

  test('marks an invalid recorded answer stale and schedules fresh runtime evaluation instead of reconstructing it', async () => {
    const { service, queueFreshRuntimeEvaluation, insertAuditRecord } = createService({
      rows: new Map([[12, {
        id: 12,
        status: 'awaiting_decision',
        metadata: answerMetadata(),
        policy_question: {},
        clarification_response: null,
      }]]),
    });

    const result = await service.run({ classificationIds: [12] });

    expect(queueFreshRuntimeEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      classificationId: 12,
    }));
    expect(insertAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
      reasonIds: expect.arrayContaining([
        POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_RECORDED,
        POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
      ]),
    }));
    expect(result.records[0]).toMatchObject({
      resultStatusId: RESULT_STATUS_IDS.QUEUED_FRESH_RUNTIME_EVALUATION,
    });
  });

  test('does not write an audit for a missing row and rejects duplicate or caller-controlled selections', async () => {
    const { service, insertAuditRecord } = createService();

    await expect(service.run({ classificationIds: [4, 4] })).rejects.toMatchObject({ statusCode: 400 });
    const result = await service.run({ classificationIds: [4] });

    expect(insertAuditRecord).not.toHaveBeenCalled();
    expect(result.records).toEqual([{
      classificationId: 4,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
      reasonIds: [],
      resultStatusId: RESULT_STATUS_IDS.NOT_FOUND,
      replayReceipt: null,
    }]);
  });
});
