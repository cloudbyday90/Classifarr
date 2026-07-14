import {
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS,
} from '../../services/policyActiveIntentIntegrity.mjs';
import {
  POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS,
  buildPolicyCandidateAuthorityEligibility,
} from '../../services/policyCandidateAuthorityEligibility.mjs';

describe('policyCandidateAuthorityEligibility', () => {
  test('blocks a candidate with a bounded repairable active-authority conflict', () => {
    const eligibility = buildPolicyCandidateAuthorityEligibility({
      policyId: 14,
      activeIntentIntegrityReport: {
        findings: [
          {
            policyId: 14,
            statusId: POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE,
            activeIntentCount: 2,
            activeIntentIds: [11, 12],
          },
        ],
      },
    });

    expect(eligibility).toEqual({
      eligible: false,
      stateId: POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT,
      integrityStatusId: POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE,
      activeIntentCount: 2,
    });
    expect(eligibility).not.toHaveProperty('activeIntentIds');
  });

  test('blocks invalid-only duplicate authority and leaves unaffected candidates eligible', () => {
    const activeIntentIntegrityReport = {
      findings: [
        {
          policyId: 14,
          statusId: POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE,
          activeIntentCount: 3,
        },
      ],
    };

    expect(buildPolicyCandidateAuthorityEligibility({
      policyId: 14,
      activeIntentIntegrityReport,
    })).toEqual(expect.objectContaining({
      eligible: false,
      integrityStatusId: POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE,
    }));
    expect(buildPolicyCandidateAuthorityEligibility({
      policyId: 15,
      activeIntentIntegrityReport,
    })).toEqual({
      eligible: true,
      stateId: POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ELIGIBLE,
    });
  });

  test('ignores malformed integrity findings rather than exposing arbitrary payload fields', () => {
    const eligibility = buildPolicyCandidateAuthorityEligibility({
      policyId: 14,
      activeIntentIntegrityReport: {
        findings: [
          {
            policyId: 14,
            statusId: 'unknown_state',
            activeIntentCount: 1,
            rawIntentPayload: { shouldNotEscape: true },
          },
        ],
      },
    });

    expect(eligibility).toEqual({
      eligible: true,
      stateId: POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ELIGIBLE,
    });
  });
});
