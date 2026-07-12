import {
  buildPolicyEvidenceInputGate,
  POLICY_EVIDENCE_INPUT_GATE_RISK_IDS,
} from './policyEvidenceInputGate.mjs';
import {
  buildPolicyEvidenceProjection,
  buildPolicyEvidenceProjectionAudit,
} from './policyEvidenceEngine.mjs';
import {
  buildPolicyEvidenceFingerprint,
  validatePolicyEvidenceFingerprint,
} from './policyEvidenceFingerprint.mjs';

const POLICY_EVIDENCE_BOUNDARY_VERSION = 'policy.evidence.boundary.v1';

const POLICY_EVIDENCE_BOUNDARY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_INPUT_GATE: 'blocked_by_input_gate',
  BLOCKED_BY_INPUT_CARDINALITY: 'blocked_by_input_cardinality',
  BLOCKED_BY_PROJECTION_AUDIT: 'blocked_by_projection_audit',
  BLOCKED_BY_PROJECTION_FINGERPRINT: 'blocked_by_projection_fingerprint',
});

const POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_STATUS: 'unknown_status',
  ISSUE_COUNT_MISMATCH: 'issue_count_mismatch',
  READY_WITHOUT_INPUT_GATE: 'ready_without_input_gate',
  READY_WITHOUT_PROJECTION: 'ready_without_projection',
  READY_WITHOUT_PROJECTION_AUDIT: 'ready_without_projection_audit',
  READY_WITHOUT_FINGERPRINT_AUDIT: 'ready_without_fingerprint_audit',
  READY_WITHOUT_NEXT_STEP: 'ready_without_next_step',
  BLOCKED_WITH_NEXT_STEP: 'blocked_with_next_step',
  BLOCKED_BY_INPUT_GATE_WITH_PROJECTION: 'blocked_by_input_gate_with_projection',
  BLOCKED_BY_PROJECTION_WITHOUT_PROJECTION: 'blocked_by_projection_without_projection',
  PROJECTION_AUDIT_STATUS_MISMATCH: 'projection_audit_status_mismatch',
  FINGERPRINT_AUDIT_STATUS_MISMATCH: 'fingerprint_audit_status_mismatch',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function asPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function getOwnDataProperty(value, key) {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;

  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ? descriptor.value
    : undefined;
}

function adaptPolicyEvidenceInput(evidenceInput = {}) {
  const input = asPlainObject(evidenceInput);

  return {
    libraryProfile: getOwnDataProperty(input, 'libraryProfile'),
    operatorIntent: getOwnDataProperty(input, 'operatorIntent'),
    classificationFinalOutcomes: getOwnDataProperty(input, 'classificationOutcomes'),
    manualCorrections: getOwnDataProperty(input, 'manualCorrections'),
    pendingItemAnswers: getOwnDataProperty(input, 'pendingItemAnswers'),
    routingOutcomes: getOwnDataProperty(input, 'arrRoutingOutcomes'),
    metadataEvidence: getOwnDataProperty(input, 'metadataEvidence'),
    profileFreshness: getOwnDataProperty(input, 'profileFreshness'),
  };
}

function buildBoundedPolicyEvidenceProjection({
  evidenceInput = {},
  projectionFingerprintBuilder = buildPolicyEvidenceFingerprint,
} = {}) {
  const inputGate = buildPolicyEvidenceInputGate({ evidenceInput });

  if (!inputGate.ok) {
    const blockedByInputCardinality = inputGate.issues.some(issue =>
      issue.riskId === POLICY_EVIDENCE_INPUT_GATE_RISK_IDS.COLLECTION_LIMIT_EXCEEDED
    );

    return {
      version: POLICY_EVIDENCE_BOUNDARY_VERSION,
      ok: false,
      statusId: blockedByInputCardinality
        ? POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_INPUT_CARDINALITY
        : POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_INPUT_GATE,
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

function buildPolicyEvidenceBoundaryAudit(boundaryResult = {}) {
  const issues = [];
  const statusIds = Object.values(POLICY_EVIDENCE_BOUNDARY_STATUS_IDS);
  const statusId = boundaryResult.statusId || null;
  const ok = boundaryResult.ok === true;
  const issueCount = Array.isArray(boundaryResult.issues)
    ? boundaryResult.issues.length
    : 0;

  if (!statusIds.includes(statusId)) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      message: 'Policy evidence boundary returned an unknown status.',
      statusId,
    });
  }

  if (boundaryResult.issueCount !== issueCount) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.ISSUE_COUNT_MISMATCH,
      message: 'Policy evidence boundary issue count must match returned issues.',
      expectedIssueCount: issueCount,
      actualIssueCount: boundaryResult.issueCount,
    });
  }

  if (ok && boundaryResult.inputGate?.ok !== true) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.READY_WITHOUT_INPUT_GATE,
      message: 'Ready policy evidence requires a successful input gate.',
    });
  }

  if (ok && !boundaryResult.projection) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.READY_WITHOUT_PROJECTION,
      message: 'Ready policy evidence requires a bounded projection.',
    });
  }

  if (ok && boundaryResult.projectionAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.READY_WITHOUT_PROJECTION_AUDIT,
      message: 'Ready policy evidence requires a successful projection audit.',
    });
  }

  if (ok && boundaryResult.projectionFingerprintAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.READY_WITHOUT_FINGERPRINT_AUDIT,
      message: 'Ready policy evidence requires a successful projection fingerprint audit.',
    });
  }

  if (ok && boundaryResult.nextStep?.stepId !== 'intent_inference') {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.READY_WITHOUT_NEXT_STEP,
      message: 'Ready policy evidence must hand off to intent inference.',
      nextStepId: boundaryResult.nextStep?.stepId || null,
    });
  }

  if (!ok && boundaryResult.nextStep) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.BLOCKED_WITH_NEXT_STEP,
      message: 'Blocked policy evidence must not hand off to the next engine.',
      nextStepId: boundaryResult.nextStep?.stepId || null,
    });
  }

  if ([
    POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_INPUT_GATE,
    POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_INPUT_CARDINALITY,
  ].includes(statusId) &&
      boundaryResult.projection) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.BLOCKED_BY_INPUT_GATE_WITH_PROJECTION,
      message: 'Input-gate failures must stop before projection construction.',
    });
  }

  if (
    statusId === POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_AUDIT &&
    !boundaryResult.projection
  ) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.BLOCKED_BY_PROJECTION_WITHOUT_PROJECTION,
      message: 'Projection-audit failures must include the rejected projection.',
    });
  }

  if (
    statusId === POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_AUDIT &&
    boundaryResult.projectionAudit?.ok !== false
  ) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.PROJECTION_AUDIT_STATUS_MISMATCH,
      message: 'Projection-audit blocked status must include a failed projection audit.',
    });
  }

  if (
    statusId === POLICY_EVIDENCE_BOUNDARY_STATUS_IDS.BLOCKED_BY_PROJECTION_FINGERPRINT &&
    boundaryResult.projectionFingerprintAudit?.ok !== false
  ) {
    issues.push({
      riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.FINGERPRINT_AUDIT_STATUS_MISMATCH,
      message: 'Projection-fingerprint blocked status must include a failed fingerprint audit.',
    });
  }

  Object.entries(asPlainObject(boundaryResult.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && sideEffectId !== 'evidenceProjectionBuilt') {
      issues.push({
        riskId: POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: 'Policy evidence boundary must not perform live lookups or storage writes.',
        sideEffectId,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    statusId,
    evidenceReady: ok,
    nextStep: boundaryResult.nextStep || null,
    issueIds: issues.map(issue => issue.riskId),
    issues,
  };
}

export {
  POLICY_EVIDENCE_BOUNDARY_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_BOUNDARY_STATUS_IDS,
  POLICY_EVIDENCE_BOUNDARY_VERSION,
  adaptPolicyEvidenceInput,
  buildBoundedPolicyEvidenceProjection,
  buildPolicyEvidenceBoundaryAudit,
};
