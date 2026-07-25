/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  ANSWER_OUTCOME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS,
  POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS,
  POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS,
  buildPolicyDiscordPendingAnswerLearning,
  buildPolicyDiscordPendingAnswerLearningAudit,
} from '../../services/policyDiscordPendingAnswerLearning.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
} from '../../services/policyRuntimeQuestionReduction.mjs';

function buildPersistedQuestionEnvelope(overrides = {}) {
  const questionReductionPlan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animation', count: 1, confidence: 0.6 },
      ],
    },
    metadataSignals: [
      { label: 'Comedy', confidence: 0.7 },
    ],
  });

  expect(questionReductionPlan.question).toBeTruthy();

  return {
    questionReductionPlan,
    question: questionReductionPlan.question,
    ...overrides,
  };
}

function validInput(overrides = {}) {
  return {
    classification: {
      id: 42,
    },
    destination: {
      libraryId: 8,
      libraryName: 'Animated Movies',
    },
    persistedQuestion: buildPersistedQuestionEnvelope(),
    selectedOptionIndex: 0,
    finalOutcomeRecorded: true,
    ...overrides,
  };
}

describe('policyDiscordPendingAnswerLearning', () => {
  test('accepts a normalized persisted answer as an outcome-only guarded decision', () => {
    const result = buildPolicyDiscordPendingAnswerLearning(validInput());

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY,
      selectedAnswerOutcomeId: ANSWER_OUTCOME_IDS.RESOLVE_CURRENT_ITEM,
      questionProof: {
        valid: true,
        version: 'policy.runtime_question_reduction.v1',
        evidenceFingerprint: expect.any(String),
      },
      decision: {
        sourceId: 'discord_pending_answer',
        finalOutcome: {
          recorded: true,
          itemId: 42,
          destinationLibraryId: 8,
        },
        learning: {
          decisionId: 'outcome_only',
          tierId: 'none',
          canWriteLearning: false,
          writesPerformed: false,
        },
      },
      sideEffects: {
        learningMutationPerformed: false,
        profileRefreshQueued: false,
        providerLookupPerformed: false,
        providerQuotaRead: false,
        routeAttemptPerformed: false,
      },
      audit: {
        ok: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain('discord-user');
  });

  test('keeps legacy persisted questions outcome-only because they have no validated fingerprint chain', () => {
    const result = buildPolicyDiscordPendingAnswerLearning(validInput({
      persistedQuestion: {
        options: [{ label: 'Animated Movies', library_id: 8 }],
      },
    }));

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY,
      selectedAnswerOutcomeId: null,
      questionProof: {
        valid: false,
      },
      decision: {
        learning: {
          decisionId: 'outcome_only',
          canWriteLearning: false,
        },
      },
      audit: {
        ok: true,
      },
    });
    expect(result.reasonCodes).toContain(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.MISSING_NORMALIZED_QUESTION
    );
    expect(result.reasonCodes).toContain(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.MISSING_QUESTION_REDUCTION_PLAN
    );
  });

  test('keeps a fingerprint-drifted question outcome-only', () => {
    const persistedQuestion = buildPersistedQuestionEnvelope();
    persistedQuestion.question = {
      ...persistedQuestion.question,
      decisionEvidenceFingerprint: {
        ...persistedQuestion.question.decisionEvidenceFingerprint,
        fingerprint: 'tampered-fingerprint',
      },
    };

    const result = buildPolicyDiscordPendingAnswerLearning(validInput({ persistedQuestion }));

    expect(result).toMatchObject({
      statusId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.OUTCOME_ONLY,
      questionProof: {
        valid: false,
      },
      decision: {
        learning: {
          canWriteLearning: false,
        },
      },
    });
    expect(result.reasonCodes).toContain(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS
        .QUESTION_REDUCTION_FINGERPRINT_MISMATCH
    );
  });

  test('blocks learning when final-outcome persistence was not confirmed', () => {
    const result = buildPolicyDiscordPendingAnswerLearning(validInput({
      finalOutcomeRecorded: false,
    }));

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_DISCORD_PENDING_ANSWER_LEARNING_STATUS_IDS.BLOCKED,
      decision: {
        finalOutcome: {
          recorded: false,
        },
        learning: {
          canWriteLearning: false,
        },
      },
      audit: {
        ok: true,
      },
    });
    expect(result.reasonCodes).toContain(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_REASON_IDS.FINAL_OUTCOME_NOT_RECORDED
    );
  });

  test('detects a tampered admission result that claims a learning mutation', () => {
    const result = buildPolicyDiscordPendingAnswerLearning(validInput());
    const audit = buildPolicyDiscordPendingAnswerLearningAudit({
      ...result,
      sideEffects: {
        ...result.sideEffects,
        learningMutationPerformed: true,
      },
    });

    expect(audit).toMatchObject({
      ok: false,
      issueCount: 1,
    });
    expect(audit.issues[0].riskId).toBe(
      POLICY_DISCORD_PENDING_ANSWER_LEARNING_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED
    );
  });
});
