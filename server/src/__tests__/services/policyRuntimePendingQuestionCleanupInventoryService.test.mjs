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
  loadPendingQuestionCleanupInventoryRows,
} from '../../services/policyRuntimePendingQuestionCleanupInventoryRepository.mjs';
import {
  buildPolicyRuntimePendingQuestionCleanupInventoryReport,
} from '../../services/policyRuntimePendingQuestionCleanupInventoryReport.mjs';
import {
  PolicyRuntimePendingQuestionCleanupInventoryService,
} from '../../services/policyRuntimePendingQuestionCleanupInventoryService.mjs';
import {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS,
} from '../../services/policyRuntimePendingQuestionCleanupPlan.mjs';
import {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
  POLICY_RUNTIME_QUESTION_REDUCTION_VERSION,
} from '../../services/policyRuntimeQuestionPersistenceContract.mjs';

function nativeQuestion({
  libraryId = 8,
  policyId = null,
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
      candidates: policyId ? [{ library_id: libraryId, policy_id: policyId }] : [],
      question_context: {
        version: contextVersion,
        library_ids: [libraryId],
        ...(policyId ? { policy_ids: [policyId] } : {}),
      },
      runtime_question_persistence: {
        version: POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
      },
    },
  };
}

function pendingRow({
  id = 42,
  status = 'awaiting_decision',
  question = nativeQuestion(),
  metadata = {},
  clarificationResponse = null,
  totalPendingCount = 1,
} = {}) {
  return {
    id,
    status,
    policy_question: JSON.stringify(question),
    metadata: JSON.stringify(metadata),
    clarification_response: clarificationResponse,
    total_pending_count: totalPendingCount,
  };
}

function createDatabase({ rows = [], libraries = [], policies = [] } = {}) {
  const query = jest.fn(async (sql) => {
    if (sql.startsWith('SET TRANSACTION')) return { rows: [] };
    if (sql.includes('FROM classification_history AS ch')) return { rows };
    if (sql.includes('FROM libraries')) return { rows: libraries };
    if (sql.includes('FROM library_policies AS lp')) return { rows: policies };

    throw new Error(`Unexpected inventory query: ${sql}`);
  });
  const db = {
    withTransaction: jest.fn(async work => work({ query })),
  };

  return { db, query };
}

describe('PolicyRuntimePendingQuestionCleanupInventoryService', () => {
  test('returns a frozen bounded report without leaking persisted question or metadata content', async () => {
    const secret = 'Do not expose this free-form legacy text.';
    const { db, query } = createDatabase({
      rows: [
        pendingRow({
          id: 42,
          metadata: { internal_note: secret },
          totalPendingCount: 2,
        }),
        pendingRow({
          id: 43,
          question: {
            question: 'Which genre should be prioritized for this destination?',
            options: [{ library_id: 8, label: 'Animated Movies' }],
          },
          metadata: { internal_note: secret },
          clarificationResponse: { selected: secret },
          totalPendingCount: 2,
        }),
      ],
      libraries: [{
        id: 8,
        is_active: true,
        updated_at: '2026-08-04T00:00:00.000Z',
      }],
    });
    const service = new PolicyRuntimePendingQuestionCleanupInventoryService({
      db,
      now: '2026-08-04T02:00:00.000Z',
    });

    const report = await service.run();

    expect(report).toMatchObject({
      mode: 'dry_run',
      generatedAt: '2026-08-04T02:00:00.000Z',
      summary: {
        totalPendingCount: 2,
        emittedRecordCount: 2,
        truncated: false,
        activeCandidateLibraryCount: 1,
      },
      sideEffects: {
        classificationRowsMutated: false,
        questionsRegenerated: false,
        outcomesResolved: false,
        learningWritten: false,
        cleanupAuditWritten: false,
      },
      validation: { ok: true },
    });
    expect(report.records[0]).toMatchObject({
      classificationId: 42,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CURRENT,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
      learning: { canWriteLearning: false },
    });
    expect(report.records[1]).toMatchObject({
      classificationId: 43,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.BLOCK_LEARNING_PERMANENTLY,
      learning: { canWriteLearning: false },
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.records)).toBe(true);
    expect(Object.isFrozen(report.records[0])).toBe(true);
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(query.mock.calls.map(([sql]) => sql.trim().split(/\s+/, 1)[0]))
      .toEqual(['SET', 'SELECT', 'SELECT']);
  });

  test('fails closed when a referenced policy is no longer active in the server snapshot', async () => {
    const { db } = createDatabase({
      rows: [pendingRow({ question: nativeQuestion({ policyId: 17 }) })],
      libraries: [{
        id: 8,
        is_active: true,
        updated_at: '2026-08-04T00:00:00.000Z',
      }],
      policies: [],
    });
    const service = new PolicyRuntimePendingQuestionCleanupInventoryService({ db });

    const report = await service.run();

    expect(report.records[0]).toMatchObject({
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
      requiresOperatorRetry: true,
    });
    expect(report.records[0].reasonIds).toContain(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.CURRENT_STATE_UNAVAILABLE,
    );
    expect(report.summary.contextUnavailableCount).toBe(1);
  });

  test('blocks a string-shaped persisted legacy response without exposing it', async () => {
    const legacyResponse = 'legacy answer text that must not be reused';
    const { db } = createDatabase({
      rows: [pendingRow({ clarificationResponse: JSON.stringify(legacyResponse) })],
      libraries: [{
        id: 8,
        is_active: true,
        updated_at: '2026-08-04T00:00:00.000Z',
      }],
    });
    const service = new PolicyRuntimePendingQuestionCleanupInventoryService({ db });

    const report = await service.run();

    expect(report.records[0]).toMatchObject({
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.BLOCK_LEARNING_PERMANENTLY,
      requiresHumanReview: true,
    });
    expect(report.records[0].reasonIds).toContain(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.LEGACY_RESPONSE_UNTRUSTED,
    );
    expect(JSON.stringify(report)).not.toContain(legacyResponse);
  });

  test('caps repository output and reports truncation without an unbounded query', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        pendingRow({ id: 1, totalPendingCount: 2 }),
        pendingRow({ id: 2, totalPendingCount: 2 }),
      ],
    });

    const result = await loadPendingQuestionCleanupInventoryRows({ query }, { maxRecords: 1 });

    expect(result).toMatchObject({
      totalPendingCount: 2,
      maxRecords: 1,
      truncated: true,
    });
    expect(result.rows).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2'), [
      ['awaiting_decision', 'pending_retry'],
      2,
    ]);
  });

  test('enforces the record cap again when the report builder is called directly', () => {
    const report = buildPolicyRuntimePendingQuestionCleanupInventoryReport({
      rows: [pendingRow({ id: 1, totalPendingCount: 2 }), pendingRow({ id: 2, totalPendingCount: 2 })],
      totalPendingCount: 2,
      maxRecords: 1,
      contextState: {
        libraries: [{
          id: 8,
          is_active: true,
          updated_at: '2026-08-04T00:00:00.000Z',
        }],
      },
    });

    expect(report.summary).toMatchObject({
      emittedRecordCount: 1,
      maxRecordCount: 1,
      truncated: true,
    });
    expect(report.records).toHaveLength(1);
    expect(report.validation).toMatchObject({ ok: true });
  });
});
