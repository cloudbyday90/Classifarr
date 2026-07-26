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
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
  buildPolicyAuthorizedOutcomePersistenceCommand,
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
} from '../../services/policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  policyManualCorrectionLearningService,
} from '../../services/policyManualCorrectionLearning.mjs';
import {
  DISCORD_PENDING_ANSWER_ACTION_IDS,
  policyDiscordPendingAnswerIntakeService,
} from '../../services/policyDiscordPendingAnswerIntake.mjs';

function manualCorrectionAdmission() {
  return policyManualCorrectionLearningService.build({
    classification: {
      id: 42,
      tmdbId: 872,
      mediaType: 'movie',
    },
    destination: {
      libraryId: 8,
      libraryName: 'Animated Movies',
    },
    finalOutcomeRecorded: true,
    sourceEventId: 'classification_correction:991',
    actorId: 'operator-7',
  });
}

function authorization(overrides = {}) {
  return {
    actorTypeId: 'operator',
    actorId: 'operator-7',
    revalidated: true,
    canRecordOutcome: true,
    canWriteLearning: true,
    authorizedSourceIds: ['manual_classification_change'],
    ...overrides,
  };
}

function currentState(overrides = {}) {
  return {
    classificationId: 42,
    sourceEventId: 'classification_correction:991',
    destinationLibraryId: 8,
    destinationLibraryName: 'Animated Movies',
    locked: true,
    ...overrides,
  };
}

describe('policyAuthorizedOutcomePersistenceCommand', () => {
  test('builds a pure, authorized exact-item write plan from canonical admission', () => {
    const admission = manualCorrectionAdmission();
    const command = buildPolicyAuthorizedOutcomePersistenceCommand({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorization: authorization(),
      currentState: currentState(),
    });

    expect(command).toMatchObject({
      ok: true,
      statusId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.READY,
      sourceId: 'manual_classification_change',
      sourceEventId: 'classification_correction:991',
      operations: {
        finalOutcome: {
          operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME,
        },
        learning: {
          operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_EXACT_ITEM_MEMORY,
          tierId: 'exact_item_memory',
          candidate: {
            key: 'manual_correction:42:movie:872',
          },
        },
        profileRefresh: null,
      },
      sideEffects: {
        finalOutcomePersisted: false,
        learningMutationPerformed: false,
        profileRefreshQueued: false,
      },
      audit: {
        ok: true,
      },
    });
  });

  test('keeps a valid outcome when learning-write authority is absent', () => {
    const admission = manualCorrectionAdmission();
    const command = buildPolicyAuthorizedOutcomePersistenceCommand({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorization: authorization({ canWriteLearning: false }),
      currentState: currentState(),
    });

    expect(command).toMatchObject({
      ok: true,
      statusId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.OUTCOME_ONLY,
      operations: {
        finalOutcome: {
          operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.RECORD_FINAL_OUTCOME,
        },
        learning: null,
        profileRefresh: null,
      },
      audit: {
        ok: true,
      },
    });
    expect(command.reasonCodes).toContain('authorized_persistence_learning_not_authorized');
  });

  test('admits canonical Discord outcome-only decisions without a learning operation', () => {
    const admission = policyDiscordPendingAnswerIntakeService.build({
      classification: {
        id: 42,
        status: 'pending',
      },
      destination: {
        libraryId: 8,
        libraryName: 'Animated Movies',
      },
      actionId: DISCORD_PENDING_ANSWER_ACTION_IDS.VERIFY_DESTINATION,
      finalOutcomeRecorded: true,
    });
    const command = buildPolicyAuthorizedOutcomePersistenceCommand({
      intake: admission.learningIntake,
      learningDecision: admission.learningGuard,
      authorization: authorization({
        authorizedSourceIds: ['discord_pending_answer'],
      }),
      currentState: currentState({
        sourceEventId: 'classification:42:discord_pending_answer:legacy',
      }),
    });

    expect(command).toMatchObject({
      ok: true,
      statusId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.OUTCOME_ONLY,
      operations: {
        learning: null,
        profileRefresh: null,
      },
      audit: {
        ok: true,
      },
    });
  });

  test('blocks an unlocked state even when the intake and guard decision are valid', () => {
    const admission = manualCorrectionAdmission();
    const command = buildPolicyAuthorizedOutcomePersistenceCommand({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorization: authorization(),
      currentState: currentState({ locked: false }),
    });

    expect(command).toMatchObject({
      ok: false,
      statusId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.BLOCKED,
      audit: {
        ok: true,
      },
    });
    expect(command.reasonCodes).toContain(
      'authorized_persistence_transaction_lock_required',
    );
  });

  test('blocks mismatched source-event correlation and unauthorized sources', () => {
    const admission = manualCorrectionAdmission();
    const command = buildPolicyAuthorizedOutcomePersistenceCommand({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorization: authorization({ authorizedSourceIds: ['discord_pending_answer'] }),
      currentState: currentState({ sourceEventId: 'classification_correction:992' }),
    });

    expect(command.ok).toBe(false);
    expect(command.reasonCodes).toEqual(expect.arrayContaining([
      'authorized_persistence_current_state_mismatch',
      'authorized_persistence_source_not_authorized',
    ]));
  });

  test('rejects a tampered command that reports a durable side effect', () => {
    const admission = manualCorrectionAdmission();
    const command = buildPolicyAuthorizedOutcomePersistenceCommand({
      intake: admission.intake,
      learningDecision: admission.decision,
      authorization: authorization(),
      currentState: currentState(),
    });
    const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit({
      ...command,
      sideEffects: {
        ...command.sideEffects,
        learningMutationPerformed: true,
      },
    });

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
    );
  });
});
