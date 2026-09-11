/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS,
  buildPolicyPurposeProposalBatchPlan,
  validatePolicyPurposeProposalBatchRequest,
} from '../../services/policyPurposeProposalBatchContract.mjs';

function profileRule(term) {
  return {
    signal_type: 'genres',
    operator: 'require_any',
    values: { require_any: [term] },
    constraint_mode: 'advisory',
    semantics: 'identity',
    source: 'media_server_library_profile',
    inference_state: 'inferred',
  };
}

function record({ policyId, libraryId, revision, rule }) {
  return {
    policy_id: policyId,
    policy_name: `Policy ${policyId}`,
    library_id: libraryId,
    library_name: `Library ${libraryId}`,
    library_media_type: 'movie',
    intent_version: revision,
    purpose_rules: [rule],
  };
}

describe('policyPurposeProposalBatchContract', () => {
  test('creates one opaque, compatible profile-derived proposal set without exposing purpose terms', () => {
    const plan = buildPolicyPurposeProposalBatchPlan({
      records: [
        record({ policyId: 9, libraryId: 19, revision: 4, rule: profileRule('not-visible-one') }),
        record({ policyId: 7, libraryId: 17, revision: 2, rule: profileRule('not-visible-two') }),
        record({
          policyId: 11,
          libraryId: 21,
          revision: 3,
          rule: { ...profileRule('not-visible-three'), source: 'unknown' },
        }),
      ],
    });

    expect(plan.presentation).toEqual(expect.objectContaining({
      statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.READY_FOR_APPLY,
      proposalFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      summary: expect.objectContaining({ candidatePolicyCount: 2, exceptionPolicyCount: 1 }),
      action: expect.objectContaining({ available: true, candidatePolicyIds: [7, 9] }),
      rawPurposeRulesExposed: false,
      providerAccessed: false,
      routingAffected: false,
    }));
    expect(plan.presentation.candidates.map(entry => entry.policy.id)).toEqual([7, 9]);
    expect(JSON.stringify(plan.presentation)).not.toContain('not-visible-one');
    expect(JSON.stringify(plan.presentation)).not.toContain('not-visible-two');
    expect(JSON.stringify(plan.presentation)).not.toContain('not-visible-three');
  });

  test('fails closed when the bounded review window is truncated', () => {
    const plan = buildPolicyPurposeProposalBatchPlan({
      records: [record({ policyId: 7, libraryId: 17, revision: 2, rule: profileRule('not-visible') })],
      truncated: true,
    });

    expect(plan.presentation).toEqual(expect.objectContaining({
      statusId: POLICY_PURPOSE_PROPOSAL_BATCH_STATUS_IDS.REVIEW_WINDOW_TRUNCATED,
      proposalFingerprint: null,
      action: expect.objectContaining({ available: false, candidatePolicyIds: [] }),
    }));
  });

  test('accepts only the exact opaque application envelope', () => {
    const request = {
      proposal_fingerprint: `sha256:${'a'.repeat(64)}`,
      candidate_policy_ids: [9, 7],
    };

    expect(validatePolicyPurposeProposalBatchRequest(request)).toEqual({
      valid: true,
      proposalFingerprint: request.proposal_fingerprint,
      candidatePolicyIds: [7, 9],
    });
    expect(validatePolicyPurposeProposalBatchRequest({
      ...request,
      purpose_rules: ['must-not-accept'],
    })).toEqual({ valid: false });
    expect(validatePolicyPurposeProposalBatchRequest({
      ...request,
      candidate_policy_ids: [7, 7],
    })).toEqual({ valid: false });
  });
});
