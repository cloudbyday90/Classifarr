import {
  buildPolicyAutomationDecisionFromEvidenceProjection,
  validatePolicyAutomationDecision,
} from './policyAutomationDecisionContract.mjs';
import {
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_VERSION,
  buildPolicyRuntimeQueueEvidenceAdmissionAudit,
} from './policyRuntimeQueueEvidenceAdmission.mjs';

const POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_VERSION =
  'policy.runtime_queue_automation_decision.v1';

const POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_INVALID_EVIDENCE_ADMISSION: 'blocked_invalid_evidence_admission',
  BLOCKED_UNSUPPORTED_INPUT: 'blocked_unsupported_input',
  BLOCKED_INVALID_DECISION: 'blocked_invalid_decision',
});

const POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS = Object.freeze({
  INVALID_RESULT: 'invalid_result',
  UNSUPPORTED_INPUT: 'unsupported_input',
  INVALID_EVIDENCE_ADMISSION: 'invalid_evidence_admission',
  INVALID_QUEUE_EVIDENCE_BINDING: 'invalid_queue_evidence_binding',
  INVALID_AUTOMATION_DECISION: 'invalid_automation_decision',
  EVIDENCE_FINGERPRINT_MISMATCH: 'evidence_fingerprint_mismatch',
  RAW_QUEUE_DATA_EXPOSED: 'raw_queue_data_exposed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'evidenceAdmission',
  'routing',
  'classification',
  'policyEvaluation',
]);

const ALLOWED_RESULT_KEYS = Object.freeze([
  'version',
  'ok',
  'statusId',
  'reasonCode',
  'queueEvidence',
  'decision',
  'sideEffects',
  'audit',
]);

const ALLOWED_QUEUE_EVIDENCE_KEYS = Object.freeze([
  'taskType',
  'attempt',
  'taskFingerprint',
  'evidenceFingerprint',
  'executionFingerprint',
]);

const SIDE_EFFECT_IDS = Object.freeze([
  'providerCalled',
  'queueMutated',
  'classificationExecuted',
  'routingExecuted',
  'questionCreated',
  'learningWritten',
]);

const UNSAFE_OUTPUT_KEYS = new Set([
  'payload',
  'queuepayload',
  'providerpayload',
  'taskid',
  'raw',
  'rawlabel',
]);

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(item => stableValue(item));
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function hasOnlyAllowedKeys(value, allowedKeys) {
  return Object.keys(asObject(value)).every(key => allowedKeys.includes(key));
}

function hasUnsafeOutputKey(value) {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([key, nestedValue]) =>
    UNSAFE_OUTPUT_KEYS.has(String(key).replace(/[^a-z0-9]/giu, '').toLowerCase()) ||
    hasUnsafeOutputKey(nestedValue)
  );
}

function buildSideEffects() {
  return {
    providerCalled: false,
    queueMutated: false,
    classificationExecuted: false,
    routingExecuted: false,
    questionCreated: false,
    learningWritten: false,
  };
}

function buildQueueEvidenceBinding(admission = {}) {
  const queueContext = asObject(admission.queueContext);
  const evidence = asObject(admission.evidence);

  return {
    taskType: normalizeString(queueContext.taskType) || null,
    attempt: Number.isInteger(queueContext.attempt) ? queueContext.attempt : null,
    taskFingerprint: normalizeString(queueContext.taskFingerprint) || null,
    evidenceFingerprint: normalizeString(evidence.fingerprint) || null,
    executionFingerprint: normalizeString(evidence.executionFingerprint) || null,
  };
}

function isReadyEvidenceAdmission(admission = {}) {
  const candidate = asObject(admission);
  const audit = buildPolicyRuntimeQueueEvidenceAdmissionAudit(candidate);

  return candidate.version === POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_VERSION &&
    candidate.ok === true &&
    candidate.statusId === POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.READY &&
    audit.ok === true;
}

function buildResult({
  ok,
  statusId,
  reasonCode,
  queueEvidence = null,
  decision = null,
} = {}) {
  const result = {
    version: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_VERSION,
    ok: ok === true,
    statusId,
    reasonCode,
    queueEvidence,
    decision,
    sideEffects: buildSideEffects(),
  };

  return {
    ...result,
    audit: buildPolicyRuntimeQueueAutomationDecisionAudit(result),
  };
}

function buildBlockedResult(statusId, reasonCode) {
  return buildResult({
    ok: false,
    statusId,
    reasonCode,
  });
}

function buildPolicyRuntimeQueueAutomationDecision(input = {}) {
  const request = asObject(input);

  if (!hasOnlyAllowedKeys(request, ALLOWED_INPUT_KEYS)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.UNSUPPORTED_INPUT
    );
  }

  const evidenceAdmission = asObject(request.evidenceAdmission);
  if (!isReadyEvidenceAdmission(evidenceAdmission)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.BLOCKED_INVALID_EVIDENCE_ADMISSION,
      POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.INVALID_EVIDENCE_ADMISSION
    );
  }

  const decision = buildPolicyAutomationDecisionFromEvidenceProjection({
    evidenceProjection: evidenceAdmission.evidence.projection,
    routing: request.routing,
    classification: request.classification,
    policyEvaluation: request.policyEvaluation,
  });
  const decisionValidation = validatePolicyAutomationDecision(decision);

  if (decisionValidation.ok !== true) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.BLOCKED_INVALID_DECISION,
      POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.INVALID_AUTOMATION_DECISION
    );
  }

  return buildResult({
    ok: true,
    statusId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.READY,
    reasonCode: 'current_queue_evidence_decided',
    queueEvidence: buildQueueEvidenceBinding(evidenceAdmission),
    decision,
  });
}

function buildPolicyRuntimeQueueAutomationDecisionAudit(result = {}) {
  const candidate = asObject(result);
  const issues = [];
  const statusIds = new Set(
    Object.values(POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS)
  );
  const queueEvidence = asObject(candidate.queueEvidence);
  const sideEffects = asObject(candidate.sideEffects);
  const isReady = candidate.statusId ===
    POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.READY;

  if (
    candidate.version !== POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_VERSION ||
    !statusIds.has(candidate.statusId) ||
    !normalizeString(candidate.reasonCode)
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.INVALID_RESULT,
      message: 'Queue automation decisions must use a supported version, status, and reason code.',
    });
  }

  if (!hasOnlyAllowedKeys(candidate, ALLOWED_RESULT_KEYS)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      message: 'Queue automation decisions cannot expose unsupported result fields.',
    });
  }

  if (!hasOnlyAllowedKeys(queueEvidence, ALLOWED_QUEUE_EVIDENCE_KEYS) ||
      hasUnsafeOutputKey(queueEvidence) ||
      hasUnsafeOutputKey(candidate.decision) ||
      hasUnsafeOutputKey(candidate.audit)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      message: 'Queue automation decisions cannot expose raw queue or provider data.',
    });
  }

  const hasExpectedSideEffectShape =
    stableJson(Object.keys(sideEffects).sort()) === stableJson([...SIDE_EFFECT_IDS].sort()) &&
    SIDE_EFFECT_IDS.every(sideEffectId => sideEffects[sideEffectId] === false);

  if (!hasExpectedSideEffectShape) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Queue automation decision construction must remain side-effect-free.',
    });
  }

  if (!isReady) {
    if (candidate.ok === true || candidate.queueEvidence !== null || candidate.decision !== null) {
      issues.push({
        riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.INVALID_RESULT,
        message: 'Blocked queue automation decisions cannot expose a usable decision or evidence binding.',
      });
    }

    return {
      ok: issues.length === 0,
      issueCount: issues.length,
      issues,
    };
  }

  if (candidate.ok !== true || candidate.decision === null) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.INVALID_RESULT,
      message: 'A ready queue automation decision requires a decision result.',
    });
  }

  const decisionValidation = validatePolicyAutomationDecision(candidate.decision);
  if (decisionValidation.ok !== true) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.INVALID_AUTOMATION_DECISION,
      message: 'Queue automation decisions require a valid base automation decision.',
    });
  }

  const expectedQueueEvidence = buildQueueEvidenceBinding({
    queueContext: queueEvidence,
    evidence: {
      fingerprint: queueEvidence.evidenceFingerprint,
      executionFingerprint: queueEvidence.executionFingerprint,
    },
  });
  const decisionFingerprint = normalizeString(
    candidate.decision?.evidence?.projectionFingerprint?.fingerprint
  );

  if (
    stableJson(queueEvidence) !== stableJson(expectedQueueEvidence) ||
    queueEvidence.taskType !== 'classification' ||
    !Number.isInteger(queueEvidence.attempt) ||
    queueEvidence.attempt < 0 ||
    !SHA256_HEX_PATTERN.test(queueEvidence.taskFingerprint || '') ||
    !SHA256_HEX_PATTERN.test(queueEvidence.evidenceFingerprint || '') ||
    !SHA256_HEX_PATTERN.test(queueEvidence.executionFingerprint || '') ||
    !queueEvidence.executionFingerprint ||
    !queueEvidence.evidenceFingerprint
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.INVALID_QUEUE_EVIDENCE_BINDING,
      message: 'Ready queue automation decisions require bounded execution evidence binding.',
    });
  }

  if (decisionFingerprint !== queueEvidence.evidenceFingerprint) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS.EVIDENCE_FINGERPRINT_MISMATCH,
      message: 'Queue evidence and automation decision fingerprints must match.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_RISK_IDS,
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_VERSION,
  buildPolicyRuntimeQueueAutomationDecision,
  buildPolicyRuntimeQueueAutomationDecisionAudit,
};
