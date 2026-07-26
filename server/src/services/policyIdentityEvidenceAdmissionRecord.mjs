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
  buildPolicyAuthorizedOutcomePersistenceCommandAudit,
} from './policyAuthorizedOutcomePersistenceCommandAudit.mjs';
import {
  asObject,
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';
import {
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS,
  POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS,
} from './policyAuthorizedOutcomePersistenceVocabulary.mjs';
import {
  buildIdentityCandidate,
  normalizeVerifiedIdentityAuthority,
} from './policyIdentityEvidenceAuthorityResolver.mjs';
import {
  POLICY_LEARNING_REASON_IDS,
  POLICY_LEARNING_TIER_IDS,
} from './policyLearningGuard.mjs';

const POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_VERSION =
  'policy.identity_evidence_admission_record.v1';

const POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS = Object.freeze({
  INVALID_AUTHORIZED_COMMAND: 'identity_admission_invalid_authorized_command',
  INVALID_OPERATION: 'identity_admission_invalid_operation',
  UNSUPPORTED_SOURCE: 'identity_admission_unsupported_source',
  LOCKED_STATE_MISMATCH: 'identity_admission_locked_state_mismatch',
  INVALID_MEDIA_TYPE: 'identity_admission_invalid_media_type',
  INVALID_CANDIDATE: 'identity_admission_invalid_candidate',
  MISSING_GUARD_REASON: 'identity_admission_missing_guard_reason',
  AUTHORITY_UNAVAILABLE: 'identity_admission_authority_unavailable',
});

const POLICY_IDENTITY_EVIDENCE_ADMISSION_SOURCE_SYSTEM =
  'policy_authorized_identity_admission';

const SUPPORTED_SOURCE_IDS = new Set([
  'manual_classification_change',
  'operator_confirmation',
  'discord_pending_answer',
  'request_destination_choice',
]);

function identifiersMatch(...values) {
  const identifiers = values.map(value => normalizeIdentifier(value));
  return identifiers.every(Boolean) && new Set(identifiers).size === 1;
}

function buildResult({ statusId, reasonCodes = [], context = null, record = null } = {}) {
  return {
    version: POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_VERSION,
    statusId,
    ready: statusId === POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS.READY,
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    context,
    record,
  };
}

function buildBlocked(reasonCodes, context = null) {
  return buildResult({
    statusId: POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS.BLOCKED,
    reasonCodes,
    context,
  });
}

function buildPolicyIdentityEvidenceAdmissionContext({ command = {}, executionState = {} } = {}) {
  const source = asObject(command);
  const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(source);
  const operations = asObject(source.operations);
  const learning = asObject(operations.learning);
  const learningCandidate = asObject(learning.candidate);
  const candidate = buildIdentityCandidate({
    evidenceKey: learningCandidate.key ?? learningCandidate.evidenceKey,
    signalType: learningCandidate.signalType,
  });
  const currentState = asObject(source.currentState);
  const finalOutcome = asObject(source.finalOutcome);
  const authorization = asObject(source.authorization);
  const state = asObject(executionState);
  const classification = asObject(state.classification);
  const destination = asObject(state.destination);

  if (source.ok !== true || audit.ok !== true) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.INVALID_AUTHORIZED_COMMAND,
    ]);
  }

  if (source.statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.READY ||
      learning.operationId !==
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_IDENTITY_EVIDENCE ||
      learning.tierId !== POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.INVALID_OPERATION,
    ]);
  }

  if (!SUPPORTED_SOURCE_IDS.has(source.sourceId)) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.UNSUPPORTED_SOURCE,
    ]);
  }

  if (!identifiersMatch(
    currentState.classificationId,
    finalOutcome.itemId,
    classification.id,
  ) || !identifiersMatch(
    currentState.destinationLibraryId,
    finalOutcome.destinationLibraryId,
    learning.candidate?.destinationLibraryId,
    destination.id,
  ) || normalizeString(currentState.destinationLibraryName) !==
      normalizeString(finalOutcome.destinationLibraryName) ||
    normalizeString(currentState.destinationLibraryName) !==
      normalizeString(learning.candidate?.destinationLibraryName) ||
    normalizeString(currentState.destinationLibraryName) !==
      normalizeString(destination.name)) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.LOCKED_STATE_MISMATCH,
    ]);
  }

  const mediaType = normalizeString(classification.mediaType, 20).toLowerCase();
  if (!['movie', 'tv'].includes(mediaType)) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.INVALID_MEDIA_TYPE,
    ]);
  }

  if (!candidate) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.INVALID_CANDIDATE,
    ]);
  }

  if (!Array.isArray(learning.reasonCodes) || !learning.reasonCodes.includes(
    POLICY_LEARNING_REASON_IDS.IDENTITY_EVIDENCE_CANDIDATE,
  )) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.MISSING_GUARD_REASON,
    ]);
  }

  return buildResult({
    statusId: POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS.READY,
    context: {
      sourceId: source.sourceId,
      sourceEventId: normalizeString(source.sourceEventId, 160),
      classificationId: normalizeIdentifier(classification.id),
      libraryId: normalizeIdentifier(destination.id),
      mediaType,
      candidate,
      actorReference: normalizeString(authorization.actorId, 128) || null,
    },
  });
}

function buildPolicyIdentityEvidenceAdmissionRecord({ context = {}, authorityResult = {} } = {}) {
  const source = asObject(context);
  const candidate = asObject(source.candidate);
  const authority = normalizeVerifiedIdentityAuthority({
    authorityResult,
    candidate,
    libraryId: normalizeIdentifier(source.libraryId),
  });

  if (!authority) {
    return buildBlocked([
      POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS.AUTHORITY_UNAVAILABLE,
    ], source);
  }

  return buildResult({
    statusId: POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS.READY,
    context: source,
    record: {
      version: POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_VERSION,
      sourceId: source.sourceId,
      sourceEventId: source.sourceEventId,
      classificationId: source.classificationId,
      libraryId: source.libraryId,
      mediaType: source.mediaType,
      signalType: candidate.nativeSignalType,
      evidenceKey: candidate.evidenceKey,
      authoritySourceId: authority.authoritySourceId,
      authorityReference: authority.authorityReference,
      authorityPolicyId: authority.policyId,
      authorityIntentId: authority.intentId,
      authorityIntentVersion: authority.intentVersion,
      authorityFingerprint: authority.authorityFingerprint,
      actorReference: source.actorReference,
      sourceSystem: POLICY_IDENTITY_EVIDENCE_ADMISSION_SOURCE_SYSTEM,
    },
  });
}

export {
  POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_REASON_IDS,
  POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_STATUS_IDS,
  POLICY_IDENTITY_EVIDENCE_ADMISSION_RECORD_VERSION,
  POLICY_IDENTITY_EVIDENCE_ADMISSION_SOURCE_SYSTEM,
  buildPolicyIdentityEvidenceAdmissionContext,
  buildPolicyIdentityEvidenceAdmissionRecord,
};
