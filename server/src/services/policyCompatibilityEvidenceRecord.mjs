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
  AUTHORITY_SOURCE_IDS,
} from './policyAuthorityVocabulary.mjs';
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
  normalizePolicyEvidenceEntry,
} from './policyEvidenceEntryNormalizer.mjs';
import {
  POLICY_EVIDENCE_SOURCE_IDS,
} from './policyEvidenceEngine.mjs';
import {
  POLICY_LEARNING_REASON_IDS,
  POLICY_LEARNING_TIER_IDS,
} from './policyLearningGuard.mjs';

const POLICY_COMPATIBILITY_EVIDENCE_RECORD_VERSION =
  'policy.compatibility_evidence_record.v1';

const POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS = Object.freeze({
  INVALID_AUTHORIZED_COMMAND: 'compatibility_evidence_invalid_authorized_command',
  INVALID_OPERATION: 'compatibility_evidence_invalid_operation',
  UNSUPPORTED_SOURCE: 'compatibility_evidence_unsupported_source',
  LOCKED_STATE_MISMATCH: 'compatibility_evidence_locked_state_mismatch',
  INVALID_MEDIA_TYPE: 'compatibility_evidence_invalid_media_type',
  UNSUPPORTED_SCOPE: 'compatibility_evidence_unsupported_scope',
  NONCANONICAL_CANDIDATE_KEY: 'compatibility_evidence_noncanonical_candidate_key',
  MISSING_GUARD_REASON: 'compatibility_evidence_missing_guard_reason',
  INVALID_EVIDENCE_ENTRY: 'compatibility_evidence_invalid_entry',
});

const POLICY_COMPATIBILITY_EVIDENCE_SCOPE_IDS = Object.freeze([
  'genre',
  'studio',
  'franchise',
  'certification',
]);

const POLICY_COMPATIBILITY_EVIDENCE_SOURCE_SYSTEM =
  'policy_authorized_compatibility';
const POLICY_COMPATIBILITY_EVIDENCE_CONFIDENCE = 50;

const SOURCE_CONFIGURATION_BY_ID = Object.freeze({
  manual_classification_change: Object.freeze({
    evidenceSourceId: POLICY_EVIDENCE_SOURCE_IDS.MANUAL_CORRECTIONS,
    evidenceReasonCode: 'persisted_manual_correction',
  }),
  operator_confirmation: Object.freeze({
    evidenceSourceId: POLICY_EVIDENCE_SOURCE_IDS.CLASSIFICATION_FINAL_OUTCOMES,
    evidenceReasonCode: 'persisted_final_outcome',
  }),
  discord_pending_answer: Object.freeze({
    evidenceSourceId: POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    evidenceReasonCode: 'persisted_pending_answer_requires_learning_guard',
  }),
  request_destination_choice: Object.freeze({
    evidenceSourceId: POLICY_EVIDENCE_SOURCE_IDS.PENDING_ITEM_ANSWERS,
    evidenceReasonCode: 'persisted_pending_answer_requires_learning_guard',
  }),
});

function buildPolicyCompatibilityEvidenceRecordResult({
  statusId,
  reasonCodes = [],
  record = null,
} = {}) {
  return {
    version: POLICY_COMPATIBILITY_EVIDENCE_RECORD_VERSION,
    statusId,
    ready: statusId === POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS.READY,
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    record,
  };
}

function buildBlockedCompatibilityEvidenceRecord(reasonCodes) {
  return buildPolicyCompatibilityEvidenceRecordResult({
    statusId: POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS.BLOCKED,
    reasonCodes,
  });
}

function normalizeCompatibilityScope(value) {
  const scope = normalizeString(value, 40).toLowerCase();

  return POLICY_COMPATIBILITY_EVIDENCE_SCOPE_IDS.includes(scope) ? scope : null;
}

function buildCanonicalCandidateKey(candidate = {}, scope) {
  const source = asObject(candidate);
  const key = normalizeString(source.key, 160);
  const prefix = `${scope}:`;

  if (!key || !key.startsWith(prefix)) {
    return null;
  }

  const value = key.slice(prefix.length);
  if (!value) return null;

  const normalizedEntry = normalizePolicyEvidenceEntry({
    key,
    label: value,
    value,
  });
  if (!normalizedEntry || normalizedEntry.key !== key) return null;

  return {
    key: normalizedEntry.key,
    value: normalizedEntry.value,
  };
}

function identifiersMatch(...values) {
  const identifiers = values.map(value => normalizeIdentifier(value));

  return identifiers.every(Boolean) && new Set(identifiers).size === 1;
}

function buildPolicyCompatibilityEvidenceRecord({
  command = {},
  executionState = {},
} = {}) {
  const source = asObject(command);
  const audit = buildPolicyAuthorizedOutcomePersistenceCommandAudit(source);
  const operations = asObject(source.operations);
  const learning = asObject(operations.learning);
  const candidate = asObject(learning.candidate);
  const currentState = asObject(source.currentState);
  const finalOutcome = asObject(source.finalOutcome);
  const authorization = asObject(source.authorization);
  const state = asObject(executionState);
  const classification = asObject(state.classification);
  const destination = asObject(state.destination);

  if (source.ok !== true || audit.ok !== true) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.INVALID_AUTHORIZED_COMMAND,
    ]);
  }

  if (source.statusId !== POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_STATUS_IDS.READY ||
      learning.operationId !==
        POLICY_AUTHORIZED_OUTCOME_PERSISTENCE_OPERATION_IDS.WRITE_COMPATIBILITY_EVIDENCE ||
      learning.tierId !== POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.INVALID_OPERATION,
    ]);
  }

  const sourceConfiguration = SOURCE_CONFIGURATION_BY_ID[source.sourceId];
  if (!sourceConfiguration) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.UNSUPPORTED_SOURCE,
    ]);
  }

  if (!identifiersMatch(
    currentState.classificationId,
    finalOutcome.itemId,
    classification.id,
  ) || !identifiersMatch(
    currentState.destinationLibraryId,
    finalOutcome.destinationLibraryId,
    candidate.destinationLibraryId,
    destination.id,
  ) || normalizeString(currentState.destinationLibraryName) !==
      normalizeString(finalOutcome.destinationLibraryName) ||
    normalizeString(currentState.destinationLibraryName) !==
      normalizeString(candidate.destinationLibraryName) ||
    normalizeString(currentState.destinationLibraryName) !==
      normalizeString(destination.name)) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.LOCKED_STATE_MISMATCH,
    ]);
  }

  const mediaType = normalizeString(classification.mediaType, 20).toLowerCase();
  if (!['movie', 'tv'].includes(mediaType)) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.INVALID_MEDIA_TYPE,
    ]);
  }

  const scope = normalizeCompatibilityScope(candidate.signalType);
  if (!scope) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.UNSUPPORTED_SCOPE,
    ]);
  }

  const canonicalCandidate = buildCanonicalCandidateKey(candidate, scope);
  if (!canonicalCandidate) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.NONCANONICAL_CANDIDATE_KEY,
    ]);
  }

  if (!Array.isArray(learning.reasonCodes) || !learning.reasonCodes.includes(
    POLICY_LEARNING_REASON_IDS.COMPATIBILITY_EVIDENCE_CANDIDATE,
  )) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.MISSING_GUARD_REASON,
    ]);
  }

  const evidenceEntry = normalizePolicyEvidenceEntry({
    key: canonicalCandidate.key,
    label: canonicalCandidate.value,
    value: canonicalCandidate.value,
    confidence: POLICY_COMPATIBILITY_EVIDENCE_CONFIDENCE,
    reasonCode: sourceConfiguration.evidenceReasonCode,
  }, {
    defaultReasonCode: sourceConfiguration.evidenceReasonCode,
    allowedReasonCodes: [sourceConfiguration.evidenceReasonCode],
  });
  if (!evidenceEntry || evidenceEntry.key !== canonicalCandidate.key) {
    return buildBlockedCompatibilityEvidenceRecord([
      POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS.INVALID_EVIDENCE_ENTRY,
    ]);
  }

  return buildPolicyCompatibilityEvidenceRecordResult({
    statusId: POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS.READY,
    record: {
      version: POLICY_COMPATIBILITY_EVIDENCE_RECORD_VERSION,
      sourceId: source.sourceId,
      sourceEventId: normalizeString(source.sourceEventId, 160) || null,
      classificationId: normalizeIdentifier(classification.id),
      libraryId: normalizeIdentifier(destination.id),
      mediaType,
      scope,
      evidenceKey: evidenceEntry.key,
      evidenceData: {
        recordVersion: POLICY_COMPATIBILITY_EVIDENCE_RECORD_VERSION,
        bucketId: 'compatibility_evidence',
        sourceId: sourceConfiguration.evidenceSourceId,
        authoritySourceId: AUTHORITY_SOURCE_IDS.MANUAL_OUTCOME,
        reasonCode: evidenceEntry.reasonCode,
      },
      confidence: POLICY_COMPATIBILITY_EVIDENCE_CONFIDENCE,
      provenance: 'policy_confirmed',
      status: 'active',
      createdBy: normalizeString(authorization.actorId, 128) || null,
      sourceClassificationId: normalizeIdentifier(classification.id),
      sourceSystem: POLICY_COMPATIBILITY_EVIDENCE_SOURCE_SYSTEM,
    },
  });
}

export {
  POLICY_COMPATIBILITY_EVIDENCE_CONFIDENCE,
  POLICY_COMPATIBILITY_EVIDENCE_RECORD_REASON_IDS,
  POLICY_COMPATIBILITY_EVIDENCE_RECORD_STATUS_IDS,
  POLICY_COMPATIBILITY_EVIDENCE_RECORD_VERSION,
  POLICY_COMPATIBILITY_EVIDENCE_SCOPE_IDS,
  POLICY_COMPATIBILITY_EVIDENCE_SOURCE_SYSTEM,
  buildPolicyCompatibilityEvidenceRecord,
  buildPolicyCompatibilityEvidenceRecordResult,
};
