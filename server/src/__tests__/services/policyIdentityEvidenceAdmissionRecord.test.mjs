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
  POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS,
  POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS,
  buildPolicyIdentityEvidenceAdmissionContext,
  buildPolicyIdentityEvidenceAdmissionRecord,
} from '../../services/policyIdentityEvidenceAdmissionRecord.mjs';
import {
  POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS,
} from '../../services/policyIdentityEvidenceAuthorityResolver.mjs';
import {
  buildPolicyLearningDecision,
} from '../../services/policyLearningGuard.mjs';
import {
  buildPolicyLearningIntakeEvent,
} from '../../services/policyLearningIntakeContract.mjs';

function identityCommand(overrides = {}) {
  const intake = buildPolicyLearningIntakeEvent({
    sourceId: 'discord_pending_answer',
    sourceEventId: 'classification:42:discord:992',
    actorId: 'operator-7',
    itemId: 42,
    answerOutcomeId: 'add_identity_evidence',
    question: { frameId: 'destination_fit', stale: false },
    answer: {
      label: 'Animated Movies',
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
    },
    candidate: {
      key: 'genre:animation',
      label: 'Animation',
      signalType: 'genre',
      destinationLibraryId: 8,
      destinationLibraryName: 'Animated Movies',
      evidenceCount: 6,
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
      sourceEventId: 'classification:42:discord:992',
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

function declaredAuthority(overrides = {}) {
  return {
    statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.VERIFIED,
    ready: true,
    authority: {
      authoritySourceId: 'operator_declared_intent',
      evidenceSourceId: 'operator_declared_intent',
      libraryId: '8',
      evidenceKey: 'genre:animation',
      signalType: 'genres',
      policyId: '18',
      intentId: '33',
      intentVersion: 4,
      authorityReference: 'native-intent:33:v4',
      authorityFingerprint: null,
      ...overrides,
    },
  };
}

describe('policyIdentityEvidenceAdmissionRecord', () => {
  test('persists an identity admission only when active declared intent independently matches', () => {
    const contextResult = buildPolicyIdentityEvidenceAdmissionContext({
      command: identityCommand(),
      executionState: executionState(),
    });
    const result = buildPolicyIdentityEvidenceAdmissionRecord({
      context: contextResult.context,
      authorityResult: declaredAuthority(),
    });

    expect(contextResult).toMatchObject({ ready: true });
    expect(result).toMatchObject({
      statusId: POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS.READY,
      ready: true,
      record: {
        sourceId: 'discord_pending_answer',
        sourceEventId: 'classification:42:discord:992',
        classificationId: '42',
        libraryId: '8',
        mediaType: 'movie',
        signalType: 'genres',
        evidenceKey: 'genre:animation',
        authoritySourceId: 'operator_declared_intent',
        authorityPolicyId: '18',
        authorityIntentId: '33',
        authorityIntentVersion: 4,
        authorityFingerprint: null,
        sourceSystem: 'policy_authorized_identity_admission',
      },
    });
    expect(JSON.stringify(result.record)).not.toContain('Animated Movies');
  });

  test('rejects manual outcome authority even when the outcome and candidate are otherwise valid', () => {
    const contextResult = buildPolicyIdentityEvidenceAdmissionContext({
      command: identityCommand(),
      executionState: executionState(),
    });
    const result = buildPolicyIdentityEvidenceAdmissionRecord({
      context: contextResult.context,
      authorityResult: declaredAuthority({
        authoritySourceId: 'manual_outcome',
      }),
    });

    expect(result).toMatchObject({
      statusId: POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS.BLOCKED,
      ready: false,
      record: null,
    });
    expect(result.reasonCodes).toContain(
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.AUTHORITY_UNAVAILABLE,
    );
  });

  test('rejects a declared authority result whose signal does not match the candidate', () => {
    const contextResult = buildPolicyIdentityEvidenceAdmissionContext({
      command: identityCommand(),
      executionState: executionState(),
    });
    const result = buildPolicyIdentityEvidenceAdmissionRecord({
      context: contextResult.context,
      authorityResult: declaredAuthority({ evidenceKey: 'genre:comedy' }),
    });

    expect(result).toMatchObject({
      ready: false,
      record: null,
    });
    expect(result.reasonCodes).toContain(
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.AUTHORITY_UNAVAILABLE,
    );
  });

  test('accepts only a current, server-qualified observed identity projection', () => {
    const contextResult = buildPolicyIdentityEvidenceAdmissionContext({
      command: identityCommand(),
      executionState: executionState(),
    });
    const observed = {
      statusId: POLICY_IDENTITY_EVIDENCE_AUTHORITY_STATUS_IDS.VERIFIED,
      ready: true,
      authority: {
        authoritySourceId: 'media_server_contents',
        evidenceSourceId: 'media_server_library_profile',
        libraryId: '8',
        evidenceKey: 'genre:animation',
        signalType: 'genres',
        profileFreshnessState: 'current',
        verified: true,
        authorityFingerprint: 'a'.repeat(64),
      },
    };
    const accepted = buildPolicyIdentityEvidenceAdmissionRecord({
      context: contextResult.context,
      authorityResult: observed,
    });
    const stale = buildPolicyIdentityEvidenceAdmissionRecord({
      context: contextResult.context,
      authorityResult: {
        ...observed,
        authority: { ...observed.authority, profileFreshnessState: 'stale' },
      },
    });

    expect(accepted).toMatchObject({
      ready: true,
      record: {
        authoritySourceId: 'media_server_contents',
        authorityPolicyId: null,
        authorityIntentId: null,
        authorityFingerprint: 'a'.repeat(64),
      },
    });
    expect(stale.reasonCodes).toContain(
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.AUTHORITY_UNAVAILABLE,
    );
  });

  test('fails before authority lookup when the identity candidate is not canonical', () => {
    const command = identityCommand();
    command.operations.learning.candidate.key = 'genre:Animation';

    const result = buildPolicyIdentityEvidenceAdmissionContext({
      command,
      executionState: executionState(),
    });

    expect(result.reasonCodes).toContain(
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.INVALID_CANDIDATE,
    );
  });
});
