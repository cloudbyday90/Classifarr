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
  QUESTION_FRAME_IDS,
  REJECTED_QUESTION_FRAME_IDS,
} from '../../services/policyQuestionLearningVocabulary.mjs';
import {
  POLICY_LEARNING_EVENT_SOURCE_IDS,
} from '../../services/policyLearningGuard.mjs';
import {
  POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS,
  POLICY_LEARNING_INTAKE_VERSION,
  buildPolicyLearningGuardInput,
  buildPolicyLearningIntakeEvent,
  validatePolicyLearningIntakeEvent,
} from '../../services/policyLearningIntakeContract.mjs';

describe('policyLearningIntakeContract', () => {
  const validInput = {
    sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.OPERATOR_CONFIRMATION,
    sourceEventId: 'classification:42:answer:operator-confirmation',
    actorId: 'operator:7',
    itemId: 42,
    answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
    question: {
      frameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
    },
    answer: {
      label: ' Animated Movies ',
      destinationLibraryId: 6,
      destinationLibraryName: ' Animated Movies ',
    },
    candidate: {
      key: 'studio:pixar',
      label: ' Pixar ',
      signalType: 'studio',
      evidenceCount: '5',
    },
    finalOutcome: {
      recorded: true,
      status: 'resolved',
    },
  };

  test.each(Object.values(POLICY_LEARNING_EVENT_SOURCE_IDS))(
    'normalizes the %s source into one guarded input contract',
    sourceId => {
      const event = buildPolicyLearningIntakeEvent({
        ...validInput,
        sourceId,
        sourceEventId: `${sourceId}:42`,
      });

      expect(event).toEqual(expect.objectContaining({
        version: POLICY_LEARNING_INTAKE_VERSION,
        sourceId,
        sourceEventId: `${sourceId}:42`,
        finalOutcome: expect.objectContaining({
          sourceId,
          answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
          itemId: 42,
          destinationLibraryId: 6,
        }),
      }));
      expect(validatePolicyLearningIntakeEvent(event)).toEqual({
        ok: true,
        issueCount: 0,
        issues: [],
      });
      expect(buildPolicyLearningGuardInput(event)).toEqual({
        sourceId,
        answerOutcomeId: ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE,
        question: {
          frameId: QUESTION_FRAME_IDS.DESTINATION_FIT,
          stale: false,
        },
        answer: {
          label: 'Animated Movies',
          destinationLibraryId: 6,
          destinationLibraryName: 'Animated Movies',
          ambiguous: false,
        },
        candidate: expect.objectContaining({
          key: 'studio:pixar',
          label: 'Pixar',
          evidenceCount: 5,
        }),
        context: expect.any(Object),
        finalOutcome: event.finalOutcome,
      });
    },
  );

  test('retains guard-blocking context without retaining raw explanation text or unknown fields', () => {
    const event = buildPolicyLearningIntakeEvent({
      ...validInput,
      context: {
        aiExplanationText: 'Long untrusted model explanation that must never become intake data.',
        providerQuotaState: ' exhausted ',
        ignored: 'not included',
      },
      ignored: 'not included',
      candidate: {
        ...validInput.candidate,
        rawProviderPayload: { secret: 'not included' },
      },
    });

    expect(event.context).toEqual({
      aiExplanationText: 'present',
      aiAuthored: false,
      providerQuotaState: 'exhausted',
      providerCooldownState: '',
      replayDiagnosticState: '',
      tmdbDiagnosticState: '',
      tmdbCoverageState: '',
    });
    expect(JSON.stringify(event)).not.toContain('Long untrusted model explanation');
    expect(JSON.stringify(event)).not.toContain('rawProviderPayload');
    expect(event).not.toHaveProperty('ignored');
  });

  test('allows a known rejected question frame to reach the guard as an outcome-only candidate', () => {
    const event = buildPolicyLearningIntakeEvent({
      ...validInput,
      question: {
        frameId: REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY,
      },
    });

    expect(event.question.frameId).toBe(REJECTED_QUESTION_FRAME_IDS.BROAD_GENRE_PRIORITY);
    expect(validatePolicyLearningIntakeEvent(event).ok).toBe(true);
  });

  test('fails closed for missing source-event correlation and unsupported source or answer values', () => {
    const event = buildPolicyLearningIntakeEvent({
      ...validInput,
      sourceId: 'browser_claimed_source',
      sourceEventId: '',
      answerOutcomeId: 'browser_claimed_outcome',
    });
    const audit = validatePolicyLearningIntakeEvent(event);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
      POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.MISSING_SOURCE_EVENT,
      POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.UNKNOWN_ANSWER_OUTCOME,
    ]));
    expect(buildPolicyLearningGuardInput(event)).toBeNull();
  });

  test('detects a mutated event that tries to decouple the final outcome from its intake source', () => {
    const event = buildPolicyLearningIntakeEvent(validInput);
    const audit = validatePolicyLearningIntakeEvent({
      ...event,
      finalOutcome: {
        ...event.finalOutcome,
        sourceId: POLICY_LEARNING_EVENT_SOURCE_IDS.DISCORD_PENDING_ANSWER,
        answerOutcomeId: ANSWER_OUTCOME_IDS.DO_NOT_LEARN,
      },
      unexpected: true,
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.UNKNOWN_FIELD,
      POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.FINAL_OUTCOME_SOURCE_MISMATCH,
      POLICY_LEARNING_INTAKE_AUDIT_RISK_IDS.FINAL_OUTCOME_ANSWER_MISMATCH,
    ]));
  });
});
