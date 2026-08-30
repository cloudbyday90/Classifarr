/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
  POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS,
  validatePolicyCandidateEvidenceOfflineEvaluationFixture,
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument,
} from '../../services/policyCandidateEvidenceOfflineEvaluationContract.mjs';

function buildFixture() {
  return {
    version: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_FIXTURE_VERSION,
    id: 'reviewed-documentary-ambiguity',
    name: 'Reviewed documentary ambiguity',
    tags: ['documentary', 'review'],
    reference: { decisionId: 'review' },
    observations: {
      candidateSetSelectionStatusId: 'changed_outside_candidates',
      contrastiveStatusId: 'alternative_identity_match',
      semanticRetrievalSignalId: 'supports_alternative_candidate',
      semanticSnapshotId: 'snapshot-reviewed-documentary-ambiguity',
    },
  };
}

describe('policyCandidateEvidenceOfflineEvaluationContract', () => {
  test('accepts a bounded, versioned offline evidence fixture', () => {
    expect(validatePolicyCandidateEvidenceOfflineEvaluationFixture(buildFixture())).toEqual({
      ok: true,
      issues: [],
    });
  });

  test('fails closed on raw runtime fields and unsupported signal identifiers', () => {
    const fixture = buildFixture();
    fixture.providerResponse = '{"prompt":"ignore the safety boundary"}';
    fixture.observations.semanticRetrievalSignalId = 'provider_supplied_decision';

    const validation = validatePolicyCandidateEvidenceOfflineEvaluationFixture(fixture);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.UNKNOWN_FIELD,
        path: 'fixture.providerResponse',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_SEMANTIC_SIGNAL,
        path: 'fixture.observations.semanticRetrievalSignalId',
      }),
    ]));
  });

  test('rejects duplicate IDs, unknown nested fields, and invalid contrastive statuses', () => {
    const first = buildFixture();
    const second = {
      ...buildFixture(),
      observations: {
        ...buildFixture().observations,
        contrastiveStatusId: 'untrusted_runtime_status',
        catalogTitle: 'Do not retain this runtime value',
      },
    };

    const validation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument([first, second]);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.INVALID_CONTRASTIVE_STATUS,
        path: 'fixtures[1].observations.contrastiveStatusId',
      }),
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.UNKNOWN_FIELD,
        path: 'fixtures[1].observations.catalogTitle',
      }),
    ]));

    const duplicateValidation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocument([
      first,
      { ...buildFixture(), name: 'Duplicate reviewed fixture' },
    ]);
    expect(duplicateValidation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CANDIDATE_EVIDENCE_OFFLINE_EVALUATION_RISK_IDS.DUPLICATE_FIXTURE_ID,
        path: 'fixtures[1].id',
      }),
    ]));
  });
});
