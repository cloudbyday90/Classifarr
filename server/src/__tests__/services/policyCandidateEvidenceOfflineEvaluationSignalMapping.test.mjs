/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyCandidateEvidenceOfflineSignalDecisions,
  mapPolicyCandidateContrastiveStatusToOfflineDecision,
  mapPolicyCandidateSelectionStatusToOfflineDecision,
  mapPolicyCandidateSemanticSignalToOfflineDecision,
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS,
} from '../../services/policyCandidateEvidenceOfflineEvaluationSignalMapping.mjs';

describe('policyCandidateEvidenceOfflineEvaluationSignalMapping', () => {
  test.each([
    ['confirmed_candidate', 'admit'],
    ['changed_to_candidate', 'admit'],
    ['changed_outside_candidates', 'review'],
    ['routed_not_applicable', 'abstain'],
  ])('maps bounded candidate-scope status %s to offline %s', (statusId, decisionId) => {
    expect(mapPolicyCandidateSelectionStatusToOfflineDecision(statusId)).toBe(decisionId);
  });

  test.each([
    ['leading_identity_match', 'admit'],
    ['alternative_identity_match', 'review'],
    ['shared_identity_match', 'abstain'],
    ['no_candidate_identity_match', 'review'],
    ['identity_unverified', 'abstain'],
    ['retrieval_unavailable', 'abstain'],
  ])('maps contrastive status %s to offline %s without inferring a route', (statusId, decisionId) => {
    expect(mapPolicyCandidateContrastiveStatusToOfflineDecision(statusId)).toBe(decisionId);
  });

  test.each([
    ['supports_leading_candidate', 'admit'],
    ['supports_alternative_candidate', 'review'],
    ['abstain', 'abstain'],
  ])('maps the proposed semantic signal %s to offline %s', (signalId, decisionId) => {
    expect(mapPolicyCandidateSemanticSignalToOfflineDecision(signalId)).toBe(decisionId);
  });

  test.each(['browser-supplied', '__proto__', 'constructor', 'toString'])(
    'fails closed for special or unknown input %s',
    (unknownValue) => {
      expect(mapPolicyCandidateSelectionStatusToOfflineDecision(unknownValue)).toBeNull();
      expect(mapPolicyCandidateContrastiveStatusToOfflineDecision(unknownValue)).toBeNull();
      expect(mapPolicyCandidateSemanticSignalToOfflineDecision(unknownValue)).toBeNull();
    },
  );

  test('exposes only three named signal dimensions', () => {
    expect(buildPolicyCandidateEvidenceOfflineSignalDecisions()).toEqual({
      [POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS.DETERMINISTIC_CANDIDATE_SCOPE]: null,
      [POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS.EXACT_CONTRASTIVE_STATUS]: null,
      [POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_SIGNAL_IDS.SEMANTIC_RETRIEVAL_PROPOSAL]: null,
    });
  });
});
