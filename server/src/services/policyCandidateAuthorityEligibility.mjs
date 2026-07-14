import {
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS,
} from './policyActiveIntentIntegrity.mjs';

const POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS = Object.freeze({
  ELIGIBLE: 'eligible',
  ACTIVE_INTENT_AUTHORITY_CONFLICT: 'active_intent_authority_conflict',
});

const ACTIVE_AUTHORITY_CONFLICT_STATUS_IDS = new Set([
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.REPAIRABLE_DUPLICATE,
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.BLOCKED_UNSAFE_DUPLICATE,
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeAuthorityFinding(finding = {}) {
  const policyId = normalizePositiveInteger(finding.policyId ?? finding.policy_id);
  const integrityStatusId = normalizeString(finding.statusId ?? finding.status_id);
  const activeIntentCount = normalizePositiveInteger(
    finding.activeIntentCount ?? finding.active_intent_count
  );

  if (
    !policyId ||
    !ACTIVE_AUTHORITY_CONFLICT_STATUS_IDS.has(integrityStatusId) ||
    !activeIntentCount ||
    activeIntentCount < 2
  ) {
    return null;
  }

  return {
    policyId,
    integrityStatusId,
    activeIntentCount,
  };
}

function buildPolicyCandidateAuthorityEligibility({
  policyId,
  activeIntentIntegrityReport = {},
} = {}) {
  const normalizedPolicyId = normalizePositiveInteger(policyId);
  const finding = asArray(activeIntentIntegrityReport?.findings)
    .map(normalizeAuthorityFinding)
    .find(candidate => candidate?.policyId === normalizedPolicyId);

  if (!finding) {
    return {
      eligible: true,
      stateId: POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ELIGIBLE,
    };
  }

  return {
    eligible: false,
    stateId: POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS.ACTIVE_INTENT_AUTHORITY_CONFLICT,
    integrityStatusId: finding.integrityStatusId,
    activeIntentCount: finding.activeIntentCount,
  };
}

export {
  POLICY_CANDIDATE_AUTHORITY_ELIGIBILITY_STATE_IDS,
  buildPolicyCandidateAuthorityEligibility,
};
