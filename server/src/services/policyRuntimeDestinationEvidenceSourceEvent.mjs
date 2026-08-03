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

import {
  ANSWER_OUTCOME_IDS,
} from './policyQuestionLearningVocabulary.mjs';
import {
  POLICY_LEARNING_TIER_IDS,
} from './policyLearningGuard.mjs';
import {
  normalizeIdentifier,
  normalizeString,
} from './policyAuthorizedOutcomePersistenceCommandValues.mjs';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_SOURCE_EVENT_VERSION =
  'policy.runtime_destination_evidence_source_event.v1';

const TIER_BY_ANSWER_OUTCOME_ID = Object.freeze({
  [ANSWER_OUTCOME_IDS.ADD_COMPATIBILITY_EVIDENCE]:
    POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
  [ANSWER_OUTCOME_IDS.ADD_IDENTITY_EVIDENCE]:
    POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
});

function getPolicyRuntimeDestinationEvidenceTierId(answerOutcomeId) {
  return TIER_BY_ANSWER_OUTCOME_ID[normalizeString(answerOutcomeId, 80)] || null;
}

function buildCandidateFingerprint({ tierId, candidateKey } = {}) {
  const normalizedTierId = normalizeString(tierId, 80);
  const normalizedCandidateKey = normalizeString(candidateKey, 160);
  if (!normalizedTierId || !normalizedCandidateKey) return null;

  return createHash('sha256')
    .update(`${normalizedTierId}\u0000${normalizedCandidateKey}`)
    .digest('base64url')
    .slice(0, 22);
}

function buildPolicyRuntimeDestinationEvidenceSourceEventId({
  classificationId,
  contractFingerprint,
  tierId,
  candidateKey,
} = {}) {
  const normalizedClassificationId = normalizeIdentifier(classificationId);
  const normalizedFingerprint = normalizeString(contractFingerprint, 64);
  const candidateFingerprint = buildCandidateFingerprint({ tierId, candidateKey });

  return normalizedClassificationId && normalizedFingerprint && candidateFingerprint
    ? `runtime_destination_evidence:${normalizedClassificationId}:${normalizedFingerprint}:${candidateFingerprint}`
    : null;
}

export {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_SOURCE_EVENT_VERSION,
  buildCandidateFingerprint,
  buildPolicyRuntimeDestinationEvidenceSourceEventId,
  getPolicyRuntimeDestinationEvidenceTierId,
};
