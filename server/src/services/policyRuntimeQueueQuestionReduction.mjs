import {
  buildPolicyRuntimeQuestionReductionFromAutomationDecision,
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';
import {
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_VERSION,
  buildPolicyRuntimeQueueAutomationDecisionAudit,
} from './policyRuntimeQueueAutomationDecision.mjs';

const POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_VERSION =
  'policy.runtime_queue_question_reduction.v1';

const POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_INVALID_QUEUE_DECISION: 'blocked_invalid_queue_decision',
  BLOCKED_UNSUPPORTED_INPUT: 'blocked_unsupported_input',
  BLOCKED_INVALID_QUESTION_PLAN: 'blocked_invalid_question_plan',
});

const POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS = Object.freeze({
  INVALID_RESULT: 'invalid_result',
  UNSUPPORTED_INPUT: 'unsupported_input',
  INVALID_QUEUE_DECISION: 'invalid_queue_decision',
  INVALID_QUEUE_EVIDENCE_BINDING: 'invalid_queue_evidence_binding',
  INVALID_QUESTION_PLAN: 'invalid_question_plan',
  EVIDENCE_FINGERPRINT_MISMATCH: 'evidence_fingerprint_mismatch',
  RAW_QUEUE_DATA_EXPOSED: 'raw_queue_data_exposed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'queueAutomationDecision',
  'requestedQuestionFrameId',
  'existingQuestion',
]);

const ALLOWED_EXISTING_QUESTION_KEYS = Object.freeze([
  'id',
  'stale',
  'cleanupRequired',
  'contractVersion',
  'version',
]);

const ALLOWED_RESULT_KEYS = Object.freeze([
  'version',
  'ok',
  'statusId',
  'reasonCode',
  'queueEvidence',
  'plan',
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
  'questionPersisted',
  'questionSent',
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

function normalizeString(value, maximumLength = 120) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
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
    questionPersisted: false,
    questionSent: false,
    learningWritten: false,
  };
}

function buildQueueEvidenceBinding(queueAutomationDecision = {}) {
  const queueEvidence = asObject(queueAutomationDecision.queueEvidence);

  return {
    taskType: normalizeString(queueEvidence.taskType) || null,
    attempt: Number.isInteger(queueEvidence.attempt) ? queueEvidence.attempt : null,
    taskFingerprint: normalizeString(queueEvidence.taskFingerprint) || null,
    evidenceFingerprint: normalizeString(queueEvidence.evidenceFingerprint) || null,
    executionFingerprint: normalizeString(queueEvidence.executionFingerprint) || null,
  };
}

function hasValidQueueEvidenceBinding(queueEvidence = {}) {
  const candidate = asObject(queueEvidence);
  const normalized = buildQueueEvidenceBinding({ queueEvidence: candidate });

  return stableJson(candidate) === stableJson(normalized) &&
    candidate.taskType === 'classification' &&
    Number.isInteger(candidate.attempt) &&
    candidate.attempt >= 0 &&
    SHA256_HEX_PATTERN.test(candidate.taskFingerprint || '') &&
    SHA256_HEX_PATTERN.test(candidate.evidenceFingerprint || '') &&
    SHA256_HEX_PATTERN.test(candidate.executionFingerprint || '');
}

function isReadyQueueAutomationDecision(queueAutomationDecision = {}) {
  const candidate = asObject(queueAutomationDecision);
  const audit = buildPolicyRuntimeQueueAutomationDecisionAudit(candidate);

  return candidate.version === POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_VERSION &&
    candidate.ok === true &&
    candidate.statusId === POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.READY &&
    audit.ok === true;
}

function normalizeExistingQuestion(value) {
  if (value == null) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!hasOnlyAllowedKeys(value, ALLOWED_EXISTING_QUESTION_KEYS)) return null;

  const existingQuestion = asObject(value);
  const id = Number(existingQuestion.id);
  const normalized = {};

  if (Number.isInteger(id) && id > 0) normalized.id = id;
  else if (Object.hasOwn(existingQuestion, 'id')) return null;

  if (existingQuestion.stale === true) normalized.stale = true;
  if (existingQuestion.cleanupRequired === true) normalized.cleanupRequired = true;

  const contractVersion = normalizeString(existingQuestion.contractVersion);
  const version = normalizeString(existingQuestion.version);
  if (contractVersion) normalized.contractVersion = contractVersion;
  if (version) normalized.version = version;

  return normalized;
}

function buildQuestionReductionInput(request = {}) {
  const input = asObject(request);
  const existingQuestion = normalizeExistingQuestion(input.existingQuestion);

  if (existingQuestion === null) return null;
  if (
    Object.hasOwn(input, 'requestedQuestionFrameId') &&
    typeof input.requestedQuestionFrameId !== 'string'
  ) {
    return null;
  }

  const requestedQuestionFrameId = normalizeString(input.requestedQuestionFrameId, 80);

  return {
    ...(requestedQuestionFrameId ? { requestedQuestionFrameId } : {}),
    ...(Object.keys(existingQuestion).length ? { existingQuestion } : {}),
  };
}

function buildResult({
  ok,
  statusId,
  reasonCode,
  queueEvidence = null,
  plan = null,
} = {}) {
  const result = {
    version: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_VERSION,
    ok: ok === true,
    statusId,
    reasonCode,
    queueEvidence,
    plan,
    sideEffects: buildSideEffects(),
  };

  return {
    ...result,
    audit: buildPolicyRuntimeQueueQuestionReductionAudit(result),
  };
}

function buildBlockedResult(statusId, reasonCode) {
  return buildResult({
    ok: false,
    statusId,
    reasonCode,
  });
}

function buildPolicyRuntimeQueueQuestionReduction(input = {}) {
  const request = asObject(input);

  if (!hasOnlyAllowedKeys(request, ALLOWED_INPUT_KEYS)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSUPPORTED_INPUT
    );
  }

  const questionInput = buildQuestionReductionInput(request);
  if (!questionInput) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSUPPORTED_INPUT
    );
  }

  const queueAutomationDecision = asObject(request.queueAutomationDecision);
  if (!isReadyQueueAutomationDecision(queueAutomationDecision)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_INVALID_QUEUE_DECISION,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_DECISION
    );
  }

  let plan;
  try {
    plan = buildPolicyRuntimeQuestionReductionFromAutomationDecision({
      automationDecision: queueAutomationDecision.decision,
      ...questionInput,
    });
  } catch {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_INVALID_QUESTION_PLAN,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUESTION_PLAN
    );
  }

  const planValidation = validatePolicyRuntimeQuestionReduction(plan);
  const queueEvidence = buildQueueEvidenceBinding(queueAutomationDecision);
  if (
    planValidation.ok !== true ||
    plan.decisionEvidenceFingerprint?.fingerprint !== queueEvidence.evidenceFingerprint
  ) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_INVALID_QUESTION_PLAN,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUESTION_PLAN
    );
  }

  return buildResult({
    ok: true,
    statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY,
    reasonCode: 'queue_automation_decision_reduced',
    queueEvidence,
    plan,
  });
}

function buildPolicyRuntimeQueueQuestionReductionAudit(result = {}) {
  const candidate = asObject(result);
  const issues = [];
  const statusIds = new Set(
    Object.values(POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS)
  );
  const queueEvidence = asObject(candidate.queueEvidence);
  const sideEffects = asObject(candidate.sideEffects);
  const isReady = candidate.statusId === POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY;

  if (
    candidate.version !== POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_VERSION ||
    !statusIds.has(candidate.statusId) ||
    !normalizeString(candidate.reasonCode)
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
      message: 'Queue question reductions must use a supported version, status, and reason code.',
    });
  }

  if (!hasOnlyAllowedKeys(candidate, ALLOWED_RESULT_KEYS)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      message: 'Queue question reductions cannot expose unsupported result fields.',
    });
  }

  if (
    !hasOnlyAllowedKeys(queueEvidence, ALLOWED_QUEUE_EVIDENCE_KEYS) ||
    hasUnsafeOutputKey(queueEvidence) ||
    hasUnsafeOutputKey(candidate.plan) ||
    hasUnsafeOutputKey(candidate.audit)
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      message: 'Queue question reductions cannot expose raw queue or provider data.',
    });
  }

  const hasExpectedSideEffectShape =
    stableJson(Object.keys(sideEffects).sort()) === stableJson([...SIDE_EFFECT_IDS].sort()) &&
    SIDE_EFFECT_IDS.every(sideEffectId => sideEffects[sideEffectId] === false);

  if (!hasExpectedSideEffectShape) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Queue question reduction must remain side-effect-free.',
    });
  }

  if (!isReady) {
    if (candidate.ok === true || candidate.queueEvidence !== null || candidate.plan !== null) {
      issues.push({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
        message: 'Blocked queue question reductions cannot expose a usable plan or evidence binding.',
      });
    }

    return {
      ok: issues.length === 0,
      issueCount: issues.length,
      issues,
    };
  }

  if (candidate.ok !== true || candidate.plan === null) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
      message: 'A ready queue question reduction requires a question-reduction plan.',
    });
  }

  if (!hasValidQueueEvidenceBinding(queueEvidence)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_EVIDENCE_BINDING,
      message: 'Ready queue question reductions require bounded execution evidence binding.',
    });
  }

  const planValidation = validatePolicyRuntimeQuestionReduction(asObject(candidate.plan));
  if (planValidation.ok !== true) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUESTION_PLAN,
      message: 'Queue question reductions require a valid base question-reduction plan.',
    });
  }

  const planFingerprint = normalizeString(
    candidate.plan?.decisionEvidenceFingerprint?.fingerprint
  );
  if (planFingerprint !== queueEvidence.evidenceFingerprint) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.EVIDENCE_FINGERPRINT_MISMATCH,
      message: 'Queue evidence and question-reduction plan fingerprints must match.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_RISK_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_VERSION,
  buildPolicyRuntimeQueueQuestionReduction,
  buildPolicyRuntimeQueueQuestionReductionAudit,
};
