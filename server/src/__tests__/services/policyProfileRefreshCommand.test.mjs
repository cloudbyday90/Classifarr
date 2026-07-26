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
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  buildPolicyAuthorizedOutcomePersistenceCommand,
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS,
} from '../../services/policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  buildPolicyLearningDecision,
} from '../../services/policyLearningGuard.mjs';
import {
  buildPolicyLearningIntakeEvent,
} from '../../services/policyLearningIntakeContract.mjs';
import {
  POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS,
  buildPolicyProfileRefreshCommand,
} from '../../services/policyProfileRefreshCommand.mjs';

function compatibilityCommand() {
  const intake = buildPolicyLearningIntakeEvent({
    sourceId: 'discord_pending_answer',
    sourceEventId: 'classification:42:discord:991',
    actorId: 'operator-7',
    itemId: 42,
    answerOutcomeId: 'add_compatibility_evidence',
    question: { frameId: 'destination_fit', stale: false },
    answer: {
      label: 'Animated Movies',
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
    },
    candidate: {
      key: 'studio:pixar',
      label: 'Pixar',
      signalType: 'studio',
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
      evidenceCount: 5,
      evidenceSource: 'manual_outcome',
    },
    finalOutcome: {
      itemId: 42,
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
      recorded: true,
    },
  });
  const learningDecision = buildPolicyLearningDecision(intake);

  return buildPolicyAuthorizedOutcomePersistenceCommand({
    intake,
    learningDecision,
    authorization: {
      actorTypeId: 'operator',
      actorId: 'operator-7',
      revalidated: true,
      canRecordOutcome: true,
      canWriteLearning: true,
      authorizedSourceIds: ['discord_pending_answer'],
    },
    currentState: {
      classificationId: 42,
      sourceEventId: 'classification:42:discord:991',
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
      locked: true,
    },
  });
}

describe('policyProfileRefreshCommand', () => {
  test('builds a compact refresh command only for an authorized compatibility learning operation', () => {
    const result = buildPolicyProfileRefreshCommand(compatibilityCommand());

    expect(result).toMatchObject({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.READY,
      ready: true,
      command: {
        sourceId: 'discord_pending_answer',
        sourceEventId: 'classification:42:discord:991',
        classificationId: '42',
        destinationLibraryId: '8',
        learningOperationId: 'write_compatibility_evidence',
        learningTierId: 'compatibility_evidence',
        candidateKey: 'studio:pixar',
        refreshReasonId: 'profile_refresh_required',
      },
    });
  });

  test('does not create a refresh command when the authorized command has no refresh operation', () => {
    const command = compatibilityCommand();
    command.operations.profileRefresh = null;
    command.audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(command);

    const result = buildPolicyProfileRefreshCommand(command);

    expect(result).toMatchObject({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.NOT_REQUESTED,
      ready: false,
      command: null,
    });
  });

  test('rejects a refresh operation without the learning guard refresh reason', () => {
    const command = compatibilityCommand();
    command.operations.profileRefresh = {
      ...command.operations.profileRefresh,
      reasonCodes: [],
    };

    const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(command);
    const result = buildPolicyProfileRefreshCommand(command);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.PROFILE_REFRESH_REASON_MISSING,
    );
    expect(result).toMatchObject({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.BLOCKED,
      ready: false,
      command: null,
    });
  });

  test('rejects a profile refresh attached to exact-item memory', () => {
    const command = compatibilityCommand();
    command.operations.learning = {
      ...command.operations.learning,
      operationId: POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_EXACT_ITEM_MEMORY,
      tierId: 'exact_item_memory',
    };

    const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(command);
    const result = buildPolicyProfileRefreshCommand(command);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.INVALID_PROFILE_REFRESH_OPERATION,
    );
    expect(result).toMatchObject({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.BLOCKED,
      ready: false,
      command: null,
    });
  });

  test('rejects a profile refresh targeting a destination other than the locked outcome', () => {
    const command = compatibilityCommand();
    command.operations.profileRefresh = {
      ...command.operations.profileRefresh,
      destinationLibraryId: 9,
    };

    const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(command);
    const result = buildPolicyProfileRefreshCommand(command);

    expect(audit.ok).toBe(false);
    expect(audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_AUDIT_RISK_IDS.PROFILE_REFRESH_DESTINATION_MISMATCH,
    );
    expect(result).toMatchObject({
      statusId: POLICY_PROFILE_REFRESH_COMMAND_STATUS_IDS.BLOCKED,
      ready: false,
      command: null,
    });
  });
});
