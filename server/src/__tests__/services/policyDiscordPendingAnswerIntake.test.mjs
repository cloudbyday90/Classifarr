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
  DISCORD_PENDING_ANSWER_ACTION_IDS,
  POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS,
  POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS,
  POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS,
  buildPolicyDiscordPendingAnswerIntake,
  buildPolicyDiscordPendingAnswerIntakeAudit,
} from '../../services/policyDiscordPendingAnswerIntake.mjs';

describe('policyDiscordPendingAnswerIntake', () => {
  const validInput = {
    classification: {
      id: 42,
      status: 'pending',
      policy_question: null,
    },
    destination: {
      libraryId: 8,
      libraryName: 'Animated Movies',
    },
    actionId: DISCORD_PENDING_ANSWER_ACTION_IDS.VERIFY_DESTINATION,
    finalOutcomeRecorded: true,
  };

  it('builds a canonical, outcome-only intake from a persisted legacy pending state', () => {
    const result = buildPolicyDiscordPendingAnswerIntake(validInput);

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.OUTCOME_ONLY,
      sourceStateId: 'legacy_pending_state',
      learningIntake: {
        sourceId: 'discord_pending_answer',
        sourceEventId: 'classification:42:discord_pending_answer:legacy',
        answerOutcomeId: 'do_not_learn',
        question: {
          frameId: 'missing_evidence',
          stale: false,
        },
        answer: {
          label: DISCORD_PENDING_ANSWER_ACTION_IDS.VERIFY_DESTINATION,
          destinationLibraryId: 8,
          destinationLibraryName: 'Animated Movies',
        },
        finalOutcome: {
          itemId: 42,
          destinationLibraryId: 8,
          destinationLibraryName: 'Animated Movies',
          recorded: true,
        },
      },
      learningGuard: {
        learning: {
          decisionId: 'outcome_only',
          canWriteLearning: false,
        },
        profileRefresh: {
          queue: false,
        },
      },
      sideEffects: {
        finalOutcomeRecorded: true,
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
  });

  it('uses only bounded native persisted-question provenance when available', () => {
    const result = buildPolicyDiscordPendingAnswerIntake({
      ...validInput,
      classification: {
        id: 42,
        status: 'awaiting_decision',
        policy_question: {
          version: 'policy.runtime_question_persistence.v1',
          runtimeQuestion: {
            contractVersion: 'policy.runtime_question_reduction.v1',
            frameId: 'destination_fit',
            stale: false,
          },
          runtimeQuestionReductionPlan: {
            version: 'policy.runtime_question_reduction.v1',
          },
          meta: {
            runtime_question_persistence: {
              evidenceFingerprint: 'evidence_20260726',
            },
          },
        },
      },
      actionId: DISCORD_PENDING_ANSWER_ACTION_IDS.CORRECT_DESTINATION,
    });

    expect(result).toMatchObject({
      ok: true,
      sourceStateId: 'native_pending_question',
      learningIntake: {
        sourceEventId: 'classification:42:discord_pending_answer:native:evidence_20260726',
        question: {
          frameId: 'destination_fit',
        },
      },
      audit: {
        ok: true,
      },
    });
  });

  it('does not admit an intake from a non-pending classification state', () => {
    const result = buildPolicyDiscordPendingAnswerIntake({
      ...validInput,
      classification: {
        ...validInput.classification,
        status: 'routed',
      },
    });

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.NOT_APPLICABLE,
      learningIntake: null,
      learningGuard: null,
      reasonCodes: [POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.NOT_PENDING],
      audit: {
        ok: true,
      },
    });
  });

  it('blocks learning evaluation when the final outcome was not persisted', () => {
    const result = buildPolicyDiscordPendingAnswerIntake({
      ...validInput,
      finalOutcomeRecorded: false,
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_DISCORD_PENDING_ANSWER_INTAKE_STATUS_IDS.BLOCKED,
      learningIntake: {
        finalOutcome: {
          recorded: false,
        },
      },
      learningGuard: {
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
      POLICY_DISCORD_PENDING_ANSWER_INTAKE_REASON_IDS.FINAL_OUTCOME_NOT_RECORDED,
    );
  });

  it('rejects a tampered result that claims a durable learning write', () => {
    const result = buildPolicyDiscordPendingAnswerIntake(validInput);
    const audit = buildPolicyDiscordPendingAnswerIntakeAudit({
      ...result,
      learningGuard: {
        ...result.learningGuard,
        learning: {
          ...result.learningGuard.learning,
          decisionId: 'candidate',
          canWriteLearning: true,
        },
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_DISCORD_PENDING_ANSWER_INTAKE_AUDIT_RISK_IDS.GUARD_NOT_OUTCOME_ONLY,
    );
  });
});
