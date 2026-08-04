/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS,
  POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS,
  buildPolicyRuntimePendingQuestionCleanupPlan,
  buildPolicyRuntimePendingQuestionCleanupPlanAudit,
} from '../../services/policyRuntimePendingQuestionCleanupPlan.mjs';
import {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
  POLICY_RUNTIME_QUESTION_REDUCTION_VERSION,
} from '../../services/policyRuntimeQuestionPersistenceContract.mjs';

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

function pendingClassification(overrides = {}) {
  return {
    id: 42,
    status: 'awaiting_decision',
    policy_question: nativeQuestion(),
    metadata: {},
    clarification_response: null,
    ...overrides,
  };
}

describe('policyRuntimePendingQuestionCleanupPlan', () => {
  test('leaves a current native pending question unchanged and learning-blocked', () => {
    const plan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification(),
      currentContextVersion: '2026-08-04T00:00:00.000Z',
      activeLibraryIds: [8],
      contextEvaluated: true,
    });

    expect(plan).toMatchObject({
      classificationId: 42,
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CURRENT,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.NONE,
      reasonIds: [],
      questionContractId: 'native_persistence',
      learning: {
        canWriteLearning: false,
        dispositionId: 'blocked',
      },
      audit: { ok: true },
    });
  });

  test('marks a legacy genre-priority question stale without retaining its text', () => {
    const unsafeText = 'Which genre should be prioritized for this destination?';
    const plan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification({
        policy_question: {
          question: unsafeText,
          options: [{ library_id: 8, label: 'Animated Movies' }],
        },
      }),
      activeLibraryIds: [8],
    });

    expect(plan).toMatchObject({
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
      questionContractId: 'legacy_or_unknown',
      requiresOperatorRetry: true,
      learning: { canWriteLearning: false },
    });
    expect(plan.reasonIds).toEqual(expect.arrayContaining([
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_CONTRACT_VERSION,
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.VAGUE_GENRE_PRIORITY,
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.MISSING_LEARNING_METADATA,
    ]));
    expect(JSON.stringify(plan)).not.toContain(unsafeText);
  });

  test('fails closed to retry when current server state was not evaluated', () => {
    const plan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification(),
    });

    expect(plan).toMatchObject({
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.MARK_STALE_REQUIRE_RETRY,
      requiresOperatorRetry: true,
      learning: { canWriteLearning: false },
    });
    expect(plan.reasonIds).toContain(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.CURRENT_STATE_UNAVAILABLE,
    );
  });

  test('requires a fresh runtime evaluation when policy context or a candidate library changed', () => {
    const contextPlan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification(),
      currentContextVersion: '2026-08-04T01:00:00.000Z',
      activeLibraryIds: [8],
      contextEvaluated: true,
    });
    const libraryPlan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification(),
      currentContextVersion: '2026-08-04T00:00:00.000Z',
      activeLibraryIds: [9],
      contextEvaluated: true,
    });

    for (const plan of [contextPlan, libraryPlan]) {
      expect(plan).toMatchObject({
        statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
        actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS
          .REGENERATE_UNDER_CURRENT_CONTRACT,
        requiresFreshRuntimeEvaluation: true,
        learning: { canWriteLearning: false },
      });
    }
    expect(contextPlan.reasonIds).toContain(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.POLICY_CONTEXT_CHANGED,
    );
    expect(libraryPlan.reasonIds).toContain(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.STALE_CANDIDATE_LIBRARY,
    );
  });

  test('routes a proven recorded runtime answer to outcome-only cleanup', () => {
    const plan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification({
        metadata: {
          classification_details: {
            outcome_link: {
              runtime_question_answer: {
                contract_version: 'policy.runtime_question_answer.v1',
                contract_fingerprint: 'answer-fingerprint',
                action_id: 'confirm_destination',
              },
            },
          },
        },
      }),
    });

    expect(plan).toMatchObject({
      statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
      actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS.RESOLVE_OUTCOME_ONLY,
      requiresHumanReview: true,
      learning: { canWriteLearning: false },
    });
    expect(plan.reasonIds).toEqual([
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RUNTIME_ANSWER_RECORDED,
    ]);
  });

  test('blocks untrusted legacy responses and raw AI context permanently', () => {
    const legacyResponsePlan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification({
        clarification_response: { option: 'Animated Movies' },
      }),
    });
    const rawAiPlan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification({
        policy_question: {
          ...nativeQuestion(),
          meta: {
            ...nativeQuestion().meta,
            ai_rationale: 'Model-only justification that must not persist.',
          },
        },
      }),
      activeLibraryIds: [8],
      contextEvaluated: true,
    });

    for (const plan of [legacyResponsePlan, rawAiPlan]) {
      expect(plan).toMatchObject({
        statusId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_STATUS_IDS.CLEANUP_REQUIRED,
        actionId: POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_ACTION_IDS
          .BLOCK_LEARNING_PERMANENTLY,
        requiresHumanReview: true,
        learning: { canWriteLearning: false, dispositionId: 'blocked' },
      });
    }
    expect(legacyResponsePlan.reasonIds).toContain(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.LEGACY_RESPONSE_UNTRUSTED,
    );
    expect(rawAiPlan.reasonIds).toContain(
      POLICY_RUNTIME_PENDING_QUESTION_CLEANUP_REASON_IDS.RAW_AI_CONTEXT,
    );
  });

  test('fails the audit when a caller tries to carry raw persisted data in the plan', () => {
    const plan = buildPolicyRuntimePendingQuestionCleanupPlan({
      classification: pendingClassification(),
      activeLibraryIds: [8],
      contextEvaluated: true,
    });

    expect(buildPolicyRuntimePendingQuestionCleanupPlanAudit({
      ...plan,
      policy_question: nativeQuestion(),
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining(['raw_record_retained']),
    });
    expect(buildPolicyRuntimePendingQuestionCleanupPlanAudit({
      ...plan,
      learning: {
        ...plan.learning,
        policy_question: nativeQuestion(),
      },
    })).toMatchObject({
      ok: false,
      issues: expect.arrayContaining(['raw_record_retained']),
    });
  });
});
