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
  buildPolicyAuthorizedOutcomePersistenceCommand,
} from '../../services/policyAuthorizedOutcomePersistenceCommand.mjs';
import {
  POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS,
  POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS,
  buildPolicyCompatibilityEvidenceRecord,
} from '../../services/policyCompatibilityEvidenceRecord.mjs';
import {
  buildPolicyLearningDecision,
} from '../../services/policyLearningGuard.mjs';
import {
  buildPolicyLearningIntakeEvent,
} from '../../services/policyLearningIntakeContract.mjs';

function compatibilityCommand(overrides = {}) {
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
    ...overrides,
  });
}

function executionState(overrides = {}) {
  return {
    classification: { id: 42, mediaType: 'movie' },
    destination: { id: 8, name: 'Animated Movies' },
    ...overrides,
  };
}

describe('policyCompatibilityEvidenceRecord', () => {
  test('builds a bounded supporting-evidence record from an authorized command', () => {
    const result = buildPolicyCompatibilityEvidenceRecord({
      command: compatibilityCommand(),
      executionState: executionState(),
    });

    expect(result).toMatchObject({
      statusId: POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS.READY,
      ready: true,
      record: {
        sourceId: 'discord_pending_answer',
        sourceEventId: 'classification:42:discord:991',
        classificationId: '42',
        libraryId: '8',
        mediaType: 'movie',
        scope: 'studio',
        evidenceKey: 'studio:pixar',
        confidence: 50,
        provenance: 'policy_confirmed',
        sourceSystem: 'policy_authorized_compatibility',
        evidenceData: {
          bucketId: 'compatibility_evidence',
          sourceId: 'pending_item_answers',
          authoritySourceId: 'manual_outcome',
          reasonCode: 'persisted_pending_answer_requires_learning_guard',
        },
      },
    });
    expect(JSON.stringify(result.record)).not.toContain('Animated Movies');
  });

  test('rejects a candidate key that is not canonical for its supported scope', () => {
    const command = compatibilityCommand();
    command.operations.learning.candidate.key = 'studio:Pixar';

    const result = buildPolicyCompatibilityEvidenceRecord({
      command,
      executionState: executionState(),
    });

    expect(result).toMatchObject({
      statusId: POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS.BLOCKED,
      ready: false,
      record: null,
    });
    expect(result.reasonCodes).toContain(
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.NONCANONICAL_CANDIDATE_KEY,
    );
  });

  test('rejects a candidate scope that cannot become compatibility evidence', () => {
    const command = compatibilityCommand();
    command.operations.learning.candidate.signalType = 'compatibility';

    const result = buildPolicyCompatibilityEvidenceRecord({
      command,
      executionState: executionState(),
    });

    expect(result.reasonCodes).toContain(
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.UNSUPPORTED_SCOPE,
    );
  });

  test('rejects identity evidence and a mismatched locked destination', () => {
    const identityCommand = compatibilityCommand();
    identityCommand.operations.learning.operationId = 'write_identity_evidence';
    identityCommand.operations.learning.tierId = 'identity_evidence';
    const identityResult = buildPolicyCompatibilityEvidenceRecord({
      command: identityCommand,
      executionState: executionState(),
    });

    const destinationResult = buildPolicyCompatibilityEvidenceRecord({
      command: compatibilityCommand(),
      executionState: executionState({ destination: { id: 9, name: 'Different Library' } }),
    });

    expect(identityResult.reasonCodes).toContain(
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.INVALID_OPERATION,
    );
    expect(destinationResult.reasonCodes).toContain(
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.LOCKED_STATE_MISMATCH,
    );
  });
});
