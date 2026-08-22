/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';
import { stableStringify } from './policyEvidenceFingerprint.mjs';

const CLASSIFICATION_QUEUE_DECISION_WITNESS_VERSION =
  'classifarr.classification_queue_decision_witness.v1';
const CLASSIFICATION_QUEUE_DECISION_WITNESS_ALGORITHM = 'sha256';
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_LIBRARY_NAME_LENGTH = 255;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asPositiveInteger(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function asConfidence(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : null;
}

function asIdentifier(value) {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value) ? value : null;
}

function asLibraryName(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LIBRARY_NAME_LENGTH) {
    return null;
  }

  return /[\u0000-\u001F\u007F]/.test(value) ? null : value;
}

function buildLibraryProjection({ libraryId, libraryName }) {
  const id = asPositiveInteger(libraryId);
  const name = asLibraryName(libraryName);

  if (id === null || name === null) {
    return null;
  }

  return { id, name };
}

function buildWitnessFingerprintProjection({ queueTaskId, outcome }) {
  return {
    version: CLASSIFICATION_QUEUE_DECISION_WITNESS_VERSION,
    queueTaskId,
    outcome,
  };
}

function hashWitnessProjection(projection) {
  return createHash('sha256')
    .update(stableStringify(projection), 'utf8')
    .digest('hex');
}

function hasExactKeys(value, expectedKeys) {
  const keys = Object.keys(value).sort();
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index]);
}

function validateOutcome(value) {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'confidence',
    'library',
    'method',
    'needsClarification',
    'needsRetry',
    'status',
  ])) {
    return { ok: false, issue: 'invalid_outcome_shape' };
  }

  const status = asIdentifier(value.status);
  const method = asIdentifier(value.method);
  const needsClarification = value.needsClarification === true;
  const needsRetry = value.needsRetry === true;
  if (!status || !method || needsClarification && needsRetry) {
    return { ok: false, issue: 'invalid_outcome_state' };
  }

  if (needsClarification || needsRetry) {
    if (value.confidence !== null || value.library !== null) {
      return { ok: false, issue: 'non_final_outcome_contains_destination' };
    }
  } else {
    if (asConfidence(value.confidence) === null || !buildLibraryProjection({
      libraryId: value.library?.id,
      libraryName: value.library?.name,
    })) {
      return { ok: false, issue: 'final_outcome_missing_destination' };
    }
  }

  return { ok: true };
}

function validateClassificationQueueDecisionWitness(value, { queueTaskId = null } = {}) {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'algorithm',
    'fingerprint',
    'outcome',
    'queueTaskId',
    'version',
  ])) {
    return { ok: false, issue: 'invalid_witness_shape' };
  }

  const normalizedQueueTaskId = asPositiveInteger(value.queueTaskId);
  if (value.version !== CLASSIFICATION_QUEUE_DECISION_WITNESS_VERSION ||
      value.algorithm !== CLASSIFICATION_QUEUE_DECISION_WITNESS_ALGORITHM ||
      normalizedQueueTaskId === null ||
      (queueTaskId !== null && normalizedQueueTaskId !== asPositiveInteger(queueTaskId))) {
    return { ok: false, issue: 'invalid_witness_identity' };
  }

  const outcomeValidation = validateOutcome(value.outcome);
  if (!outcomeValidation.ok) {
    return outcomeValidation;
  }

  const expectedFingerprint = hashWitnessProjection(buildWitnessFingerprintProjection({
    queueTaskId: normalizedQueueTaskId,
    outcome: value.outcome,
  }));
  if (typeof value.fingerprint !== 'string' || !SHA256_PATTERN.test(value.fingerprint) ||
      value.fingerprint !== expectedFingerprint) {
    return { ok: false, issue: 'invalid_witness_fingerprint' };
  }

  return { ok: true };
}

function buildClassificationQueueDecisionWitness({ queueTaskId, result = {}, persistenceState = {} } = {}) {
  const normalizedQueueTaskId = asPositiveInteger(queueTaskId);
  if (normalizedQueueTaskId === null || !isPlainObject(result) || !isPlainObject(persistenceState)) {
    return null;
  }

  const needsClarification = result.needs_clarification === true;
  const needsRetry = result.needs_retry === true;
  const outcome = {
    status: asIdentifier(persistenceState.status),
    method: asIdentifier(result.method),
    confidence: needsClarification || needsRetry ? null : asConfidence(result.confidence),
    library: needsClarification || needsRetry ? null : buildLibraryProjection({
      libraryId: persistenceState.libraryId,
      libraryName: persistenceState.libraryName,
    }),
    needsClarification,
    needsRetry,
  };

  const candidate = {
    version: CLASSIFICATION_QUEUE_DECISION_WITNESS_VERSION,
    algorithm: CLASSIFICATION_QUEUE_DECISION_WITNESS_ALGORITHM,
    queueTaskId: normalizedQueueTaskId,
    outcome,
  };
  candidate.fingerprint = hashWitnessProjection(buildWitnessFingerprintProjection(candidate));

  return validateClassificationQueueDecisionWitness(candidate).ok ? candidate : null;
}

export {
  CLASSIFICATION_QUEUE_DECISION_WITNESS_ALGORITHM,
  CLASSIFICATION_QUEUE_DECISION_WITNESS_VERSION,
  buildClassificationQueueDecisionWitness,
  validateClassificationQueueDecisionWitness,
};
