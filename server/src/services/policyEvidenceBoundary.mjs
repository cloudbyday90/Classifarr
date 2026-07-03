import {
  buildPolicyBuilderPhase6EvidenceInputGate as buildPolicyEvidenceInputGate,
} from './policyBuilderPhase6EvidenceInputGate.mjs';
import {
  buildPolicyBuilderPhase6EvidenceProjection as buildPolicyEvidenceProjection,
  buildPolicyBuilderPhase6EvidenceProjectionAudit as buildPolicyEvidenceProjectionAudit,
} from './policyBuilderPhase6EvidenceEngine.mjs';
import {
  buildPolicyEvidenceFingerprint,
  validatePolicyEvidenceFingerprint,
} from './policyEvidenceFingerprint.mjs';

const POLICY_EVIDENCE_BOUNDARY_VERSION = 'policy.evidence.boundary.v1';

const POLICY_EVIDENCE_BOUNDARY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_INPUT_GATE: 'blocked_by_input_gate',
  BLOCKED_BY_PROJECTION_AUDIT: 'blocked_by_projection_audit',
  BLOCKED_BY_PROJECTION_FINGERPRINT: 'blocked_by_projection_fingerprint',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function adaptPolicyEvidenceInput(evidenceInput = {}) {
  const input = asPlainObject(evidenceInput);

  return {
    libraryProfile: input.libraryProfile,
    operatorIntent: input.operatorIntent,
    classificationFinalOutcomes: input.classificationOutcomes,
    manualCorrections: input.manualCorrections,
    pendingItemAnswers: input.pendingItemAnswers,
    routingOutcomes: input.arrRoutingOutcomes,
    metadataEvidence: input.metadataEvidence,
    profileFreshness: input.profileFreshness,
  };
}

function buildBoundedPolicyEvidenceProjection({
  evidenceInput = {},
  projectionFingerprintBuilder = buildPolicyEvidenceFingerprint,
} = {}) {
  const inputGate = buildPolicyEvidenceInputGate({ evidenceInput });

  if (!inputGate.ok) {
    return {
      version: POLICY_EVIDENCE_BOUNDARY_VERSION,
      ok: false,
      statusId: POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_INPUT_GATE,
      inputGate,
      projection: null,
      projectionAudit: null,
      projectionFingerprint: null,
      issueCount: inputGate.issueCount,
      issues: inputGate.issues,
      sideEffects: {
        liveProviderLookupPerformed: false,
        providerQuotaRead: false,
        evidenceProjectionBuilt: false,
        policyStorageMutated: false,
      },
      nextStep: null,
    };
  }

  const projectionInput = adaptPolicyEvidenceInput(evidenceInput);
  const projection = buildPolicyEvidenceProjection(projectionInput);
  const projectionAudit = buildPolicyEvidenceProjectionAudit(projection);
  const fingerprintBuilder = typeof projectionFingerprintBuilder === 'function'
    ? projectionFingerprintBuilder
    : buildPolicyEvidenceFingerprint;
  const projectionFingerprint = projectionAudit.ok === true
    ? fingerprintBuilder(projection)
    : null;
  const projectionFingerprintAudit = projectionAudit.ok === true
    ? validatePolicyEvidenceFingerprint({
        projection,
        projectionFingerprint,
      })
    : null;
  const ok = projectionAudit.ok === true && projectionFingerprintAudit?.ok === true;
  const issues = projectionAudit.ok === true
    ? projectionFingerprintAudit.issues
    : projectionAudit.issues;

  return {
    version: POLICY_EVIDENCE_BOUNDARY_VERSION,
    ok,
    statusId: ok
      ? POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.READY
      : projectionAudit.ok === true
        ? POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_FINGERPRINT
        : POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_AUDIT,
    inputGate,
    projection,
    projectionAudit,
    projectionFingerprint,
    projectionFingerprintAudit,
    issueCount: issues.length,
    issues,
    sideEffects: {
      liveProviderLookupPerformed: false,
      providerQuotaRead: false,
      evidenceProjectionBuilt: true,
      policyStorageMutated: false,
    },
    nextStep: ok
      ? {
          stepId: 'intent_inference',
          label: 'Intent Inference',
          reason: 'Evidence input has passed the boundary and projection audit, so intent inference can consume bounded evidence.',
        }
      : null,
  };
}

export {
  POLICY_EVIDENCE_BOUNDARY_STATUS_IDS,
  POLICY_EVIDENCE_BOUNDARY_VERSION,
  adaptPolicyEvidenceInput,
  buildBoundedPolicyEvidenceProjection,
};
