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
import {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
  POLICY_RUNTIME_QUESTION_REDUCTION_VERSION,
} from '../../services/policyRuntimeQuestionPersistenceContract.mjs';
import {
  buildPolicyRuntimeQuestionAnswerContract,
} from '../../services/policyRuntimeQuestionAnswerContract.mjs';
import {
  FRESH_RUNTIME_EVALUATION_PENDING_REASON,
} from '../../services/policyRuntimePendingQuestionCleanupApplyRepository.mjs';

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

function nativeQuestion({
  libraryId = 8,
  contextVersion = '2026-08-04T00:00:00.000Z',
} = {}) {
  return {
    version: POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
    question: 'Does this item belong in this destination?',
    options: [{
      label: 'Animated Movies',
      value: 'resolve_current_item',
      outcomeId: 'resolve_current_item',
      library_id: libraryId,
      library_name: 'Animated Movies',
      learningEligible: false,
    }],
    runtimeQuestion: {
      contractVersion: POLICY_RUNTIME_QUESTION_REDUCTION_VERSION,
      learning: {
        eligible: false,
        requiresLearningGuard: false,
        allowedOutcomeIds: ['resolve_current_item', 'do_not_learn'],
      },
    },
    runtimeQuestionReductionPlan: {
      version: POLICY_RUNTIME_QUESTION_REDUCTION_VERSION,
    },
    meta: {
      question_context: {
        version: contextVersion,
        library_ids: [libraryId],
      },
      runtime_question_persistence: {
        version: POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
      },
    },
  };
}

function createService({
  rows = new Map(),
  replayResult = null,
  currentContext = null,
  freshRuntimeReplay = null,
  withTransaction = null,
  queueFreshRuntimeEvaluation: providedQueueFreshRuntimeEvaluation = null,
  insertAuditRecord: providedInsertAuditRecord = null,
} = {}) {
  const lockClassification = jest.fn(async ({ classificationId }) => rows.get(classificationId) || null);
  const loadCurrentContext = jest.fn(async () => currentContext || ({
    activeLibraryIds: [],
    currentContextVersion: null,
    contextEvaluated: true,
  }));
  const loadFreshRuntimeReplay = jest.fn(async () => freshRuntimeReplay);
  const queueFreshRuntimeEvaluation = providedQueueFreshRuntimeEvaluation || jest.fn(async () => undefined);
  const replayOutcome = jest.fn(async () => replayResult || {
    resolved: false,
    reasonId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_INVALID_CURRENT_STATE,
  });
  const insertAuditRecord = providedInsertAuditRecord ||
    jest.fn(async ({ replayReceipt }) => ({ replay_receipt: replayReceipt }));
  const db = {
    withTransaction: withTransaction || jest.fn(async work => work({ query: jest.fn() })),
  };
  let receiptNumber = 0;
  const service = new PolicyRuntimePendingQuestionCleanupApplyService({
    db,
    lockClassification,
    loadCurrentContext,
    loadFreshRuntimeReplay,
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
    loadFreshRuntimeReplay,
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

  test('does not alter a current question and records only the bounded unchanged audit', async () => {
    const classification = Object.freeze({
      id: 16,
      status: 'awaiting_decision',
      policy_question: nativeQuestion(),
      metadata: {},
      clarification_response: null,
    });
    const { service, queueFreshRuntimeEvaluation, replayOutcome, insertAuditRecord } = createService({
      rows: new Map([[16, classification]]),
      currentContext: {
        activeLibraryIds: [8],
        currentContextVersion: '2026-08-04T00:00:00.000Z',
        contextEvaluated: true,
      },
    });

    const result = await service.run({ classificationIds: [16] });

    expect(queueFreshRuntimeEvaluation).not.toHaveBeenCalled();
    expect(replayOutcome).not.toHaveBeenCalled();
    expect(insertAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
      resultStatusId: RESULT_STATUS_IDS.UNCHANGED,
    }));
    expect(result.records[0]).toMatchObject({
      statusId: 'current',
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
      resultStatusId: RESULT_STATUS_IDS.UNCHANGED,
    });
    expect(classification.policy_question).toEqual(nativeQuestion());
  });

  test('fails closed for a stale cross-library question and queues a fresh evaluation', async () => {
    const { service, queueFreshRuntimeEvaluation, replayOutcome, insertAuditRecord } = createService({
      rows: new Map([[20, {
        id: 20,
        status: 'awaiting_decision',
        policy_question: nativeQuestion({ libraryId: 8 }),
        metadata: {},
        clarification_response: null,
      }]]),
      currentContext: {
        activeLibraryIds: [9],
        currentContextVersion: '2026-08-04T00:00:00.000Z',
        contextEvaluated: true,
      },
    });

    const result = await service.run({ classificationIds: [20] });

    expect(queueFreshRuntimeEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      classificationId: 20,
    }));
    expect(replayOutcome).not.toHaveBeenCalled();
    expect(insertAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS
        .REGENERATE_UNDER_CURRENT_CONTRACT,
      reasonIds: expect.arrayContaining([
        POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.STALE_CANDIDATE_LIBRARY,
      ]),
    }));
    expect(result.records[0].resultStatusId)
      .toBe(RESULT_STATUS_IDS.QUEUED_FRESH_RUNTIME_EVALUATION);
  });

  test('clears unsafe question data so no answer, learning, or policy-edit contract remains', async () => {
    const classification = {
      id: 22,
      status: 'awaiting_decision',
      media_type: 'movie',
      policy_question: {
        question: 'Which genre should be prioritized for this destination?',
        options: [{ library_id: 8, label: 'Animated Movies' }],
      },
      metadata: {},
      clarification_response: { selected: 'legacy free-form selection' },
    };
    const queueFreshRuntimeEvaluation = jest.fn(async () => {
      classification.status = 'pending_retry';
      classification.policy_question = null;
      classification.clarification_response = null;
      classification.pending_reason = FRESH_RUNTIME_EVALUATION_PENDING_REASON;
    });
    const { service, replayOutcome, insertAuditRecord } = createService({
      rows: new Map([[22, classification]]),
      queueFreshRuntimeEvaluation,
    });

    const result = await service.run({ classificationIds: [22] });
    const answerContract = buildPolicyRuntimeQuestionAnswerContract({
      classification,
      question: classification.policy_question,
    });

    expect(classification).toMatchObject({
      status: 'pending_retry',
      policy_question: null,
      clarification_response: null,
      pending_reason: FRESH_RUNTIME_EVALUATION_PENDING_REASON,
    });
    expect(answerContract).toBeNull();
    expect(replayOutcome).not.toHaveBeenCalled();
    expect(insertAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.BLOCK_LEARNING_PERMANENTLY,
    }));
    expect(result.sideEffects.learningWritten).toBe(false);
  });

  test('reuses the original receipt for an already queued cleanup retry without a second write', async () => {
    const replayReceipt = '00000000-0000-4000-8000-000000000099';
    const { service, loadCurrentContext, loadFreshRuntimeReplay,
      queueFreshRuntimeEvaluation, replayOutcome, insertAuditRecord } = createService({
      rows: new Map([[24, {
        id: 24,
        status: 'pending_retry',
        pending_reason: FRESH_RUNTIME_EVALUATION_PENDING_REASON,
        policy_question: null,
        metadata: {},
        clarification_response: null,
      }]]),
      freshRuntimeReplay: {
        action_id: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
        reason_ids: [POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_POLICY_QUESTION],
        source_version: 'policy.runtime_pending_question_cleanup.v1',
        result_status_id: RESULT_STATUS_IDS.QUEUED_FRESH_RUNTIME_EVALUATION,
        replay_receipt: replayReceipt,
      },
    });

    const result = await service.run({ classificationIds: [24] });

    expect(loadFreshRuntimeReplay).toHaveBeenCalledTimes(1);
    expect(loadCurrentContext).not.toHaveBeenCalled();
    expect(queueFreshRuntimeEvaluation).not.toHaveBeenCalled();
    expect(replayOutcome).not.toHaveBeenCalled();
    expect(insertAuditRecord).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      summary: {
        requestedRecordCount: 1,
        replayedRecordCount: 1,
        queued_fresh_runtime_evaluation: 1,
      },
      sideEffects: {
        cleanupAuditWritten: false,
        learningWritten: false,
      },
      records: [{
        classificationId: 24,
        replayed: true,
        replayReceipt,
      }],
    });
  });

  test('does not trust an incomplete cleanup marker and runs the normal server-derived plan', async () => {
    const { service, loadCurrentContext, queueFreshRuntimeEvaluation, insertAuditRecord } = createService({
      rows: new Map([[25, {
        id: 25,
        status: 'pending_retry',
        pending_reason: FRESH_RUNTIME_EVALUATION_PENDING_REASON,
        policy_question: null,
        metadata: {},
        clarification_response: null,
      }]]),
      freshRuntimeReplay: {
        action_id: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
        reason_ids: [],
        source_version: 'not-a-cleanup-audit',
        result_status_id: RESULT_STATUS_IDS.QUEUED_FRESH_RUNTIME_EVALUATION,
        replay_receipt: '00000000-0000-4000-8000-000000000100',
      },
    });

    await service.run({ classificationIds: [25] });

    expect(loadCurrentContext).toHaveBeenCalledTimes(1);
    expect(queueFreshRuntimeEvaluation).toHaveBeenCalledTimes(1);
    expect(insertAuditRecord).toHaveBeenCalledTimes(1);
  });

  test('propagates an interrupted apply so the transaction boundary can roll back all staged writes', async () => {
    const transactionClient = { query: jest.fn() };
    let rollbackCount = 0;
    let commitCount = 0;
    const withTransaction = jest.fn(async work => {
      try {
        const result = await work(transactionClient);
        commitCount += 1;
        return result;
      } catch (error) {
        rollbackCount += 1;
        throw error;
      }
    });
    const insertAuditRecord = jest.fn(async () => {
      throw new Error('simulated audit persistence interruption');
    });
    const { service, queueFreshRuntimeEvaluation } = createService({
      rows: new Map([[31, {
        id: 31,
        status: 'awaiting_decision',
        policy_question: null,
        metadata: {},
        clarification_response: null,
      }]]),
      withTransaction,
      insertAuditRecord,
    });

    await expect(service.run({ classificationIds: [31] }))
      .rejects.toThrow('simulated audit persistence interruption');

    expect(queueFreshRuntimeEvaluation).toHaveBeenCalledWith({
      client: transactionClient,
      classificationId: 31,
    });
    expect(insertAuditRecord).toHaveBeenCalledWith(expect.objectContaining({
      client: transactionClient,
      classificationId: 31,
    }));
    expect(commitCount).toBe(0);
    expect(rollbackCount).toBe(1);
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
