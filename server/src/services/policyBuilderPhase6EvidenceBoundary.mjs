import {
  buildPolicyBuilderPhase6EvidenceInputGate,
} from './policyBuilderPhase6EvidenceInputGate.mjs';
import {
  buildPolicyBuilderPhase6EvidenceProjection,
  buildPolicyBuilderPhase6EvidenceProjectionAudit,
} from './policyBuilderPhase6EvidenceEngine.mjs';
import {
  buildPolicyEvidenceFingerprint,
  validatePolicyEvidenceFingerprint,
} from './policyEvidenceFingerprint.mjs';

const PHASE6R_EVIDENCE_BOUNDARY_VERSION = 'phase6r.evidence_boundary.v1';

const PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_INPUT_GATE: 'blocked_by_input_gate',
  BLOCKED_BY_PROJECTION_AUDIT: 'blocked_by_projection_audit',
  BLOCKED_BY_PROJECTION_FINGERPRINT: 'blocked_by_projection_fingerprint',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function adaptPolicyBuilderPhase6EvidenceInput(evidenceInput = {}) {
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

function buildPolicyBuilderPhase6BoundedEvidenceProjection({
  evidenceInput = {},
  projectionFingerprintBuilder = buildPolicyEvidenceFingerprint,
} = {}) {
  const inputGate = buildPolicyBuilderPhase6EvidenceInputGate({ evidenceInput });

  if (!inputGate.ok) {
    return {
      version: PHASE6R_EVIDENCE_BOUNDARY_VERSION,
      ok: false,
      statusId: PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_INPUT_GATE,
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
      nextPhase: null,
    };
  }

  const projectionInput = adaptPolicyBuilderPhase6EvidenceInput(evidenceInput);
  const projection = buildPolicyBuilderPhase6EvidenceProjection(projectionInput);
  const projectionAudit = buildPolicyBuilderPhase6EvidenceProjectionAudit(projection);
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
    version: PHASE6R_EVIDENCE_BOUNDARY_VERSION,
    ok,
    statusId: ok
      ? PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS.READY
      : projectionAudit.ok === true
        ? PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_FINGERPRINT
        : PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_AUDIT,
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
    nextPhase: ok
      ? {
          phaseId: '6r_2',
          label: 'Intent Engine',
          reason: 'Evidence input has passed the boundary and projection audit, so intent inference can consume bounded evidence.',
        }
      : null,
  };
}

export {
  PHASE6R_EVIDENCE_BOUNDARY_STATUS_IDS,
  PHASE6R_EVIDENCE_BOUNDARY_VERSION,
  adaptPolicyBuilderPhase6EvidenceInput,
  buildPolicyBuilderPhase6BoundedEvidenceProjection,
};
