/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  createHeldOutSemanticStudyEligibilityAudit,
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION,
  HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS,
} from '../../services/heldOutSemanticStudyEligibilityAudit.mjs';

function candidates() {
  return [
    { stratum: 'documentary', metadata: { media_type: 'movie', title: 'Private documentary', tmdb_id: 1 } },
    { stratum: 'reality', metadata: { media_type: 'tv', title: 'Private reality', tmdb_id: 2 } },
  ];
}

function preparation() {
  return {
    assess: jest.fn(async ({ metadata }) => metadata.tmdb_id === 1
      ? {
        contract: { valid: true, statusId: 'ready' },
        diagnostic: { actionId: 'prompt_select', rankedCandidateCountId: 'two_or_more' },
      }
      : {
        contract: { valid: false, statusId: 'not_pending_policy_decision' },
        diagnostic: { actionId: 'manual', rankedCandidateCountId: 'none' },
      }),
    loadPolicies: jest.fn(async () => [{ library_id: 9 }]),
  };
}

test('reports fixed aggregate eligibility only across the supplied canonical population', async () => {
  const service = createHeldOutSemanticStudyEligibilityAudit({
    loadCandidates: jest.fn(async () => ({ candidates: candidates(), truncated: false })),
    preparation: preparation(),
    readConfig: async () => ({ model: 'private' }),
  });

  const result = await service.audit();

  expect(result.status.id).toBe(HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.COMPLETE);
  expect(result.summary).toMatchObject({
    candidateCount: 2,
    candidateCountByStratum: { documentary: 1, reality: 1 },
    comparisonEligibilityPartition: {
      version: 'policy.held_out_semantic_study_comparison_eligibility_partition.v1',
      comparisonCount: 2,
      eligibleComparisonCount: 1,
      ineligibleComparisonCount: 1,
      policyOnlyComparisonAvailable: true,
      rawCandidateDataExposed: false,
      reasonCounts: {
        identity_unverified: 0,
        insufficient_policy_candidates: 0,
        invalid_contract: 0,
        not_pending_policy_decision: 1,
        ready_comparison: 1,
      },
      semanticSelection: false,
    },
    eligibilityDecisionCounts: { 'manual:none': 1, 'prompt_select:two_or_more': 1 },
    eligibilityStatusCounts: { not_pending_policy_decision: 1, ready: 1 },
    eligibleCountByStratum: { documentary: 1, reality: 0 },
    independentLabelsAvailable: false,
    policyChangeEligibility: false,
    policySourceScreen: expect.objectContaining({
      rawConfigurationExposed: false,
      statusId: 'no_observed_purpose_rules',
    }),
    semanticSelection: false,
  });
  expect(result.version).toBe(HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION);
  expect(JSON.stringify(result)).not.toMatch(/Private|tmdb|library|model/u);
});

test('fails closed when configuration changes while the audit runs', async () => {
  let reads = 0;
  const service = createHeldOutSemanticStudyEligibilityAudit({
    loadCandidates: jest.fn(async () => ({ candidates: candidates(), truncated: false })),
    preparation: preparation(),
    readConfig: async () => ({ embedding_model: ++reads === 1 ? 'before' : 'after' }),
  });

  await expect(service.audit()).resolves.toEqual({
    version: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION,
    status: { id: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.CONFIGURATION_CHANGED },
    summary: null,
  });
});

test('returns the current contract version when the audit fails closed', async () => {
  const service = createHeldOutSemanticStudyEligibilityAudit({
    loadCandidates: jest.fn(async () => {
      throw new Error('private-source-unavailable');
    }),
    preparation: preparation(),
    readConfig: async () => ({ model: 'private' }),
  });

  await expect(service.audit()).resolves.toEqual({
    version: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION,
    status: { id: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.FAILED },
    summary: null,
  });
});
