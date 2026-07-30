import {
  POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS,
  buildPolicyRuntimeQueueAutomationDecision,
  buildPolicyRuntimeQueueAutomationDecisionAudit,
} from './policyRuntimeQueueAutomationDecision.mjs';
import {
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS,
  buildPolicyRuntimeQueueEvidenceAdmission,
  buildPolicyRuntimeQueueEvidenceAdmissionAudit,
} from './policyRuntimeQueueEvidenceAdmission.mjs';
import {
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS,
  buildPolicyRuntimeQueueQuestionReduction,
  buildPolicyRuntimeQueueQuestionReductionAudit,
} from './policyRuntimeQueueQuestionReduction.mjs';

const POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_VERSION =
  'policy.runtime_queue_question_reduction_producer.v1';

const POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_UNSUPPORTED_INPUT: 'blocked_unsupported_input',
  BLOCKED_EVIDENCE_ADMISSION: 'blocked_evidence_admission',
  BLOCKED_AUTOMATION_DECISION: 'blocked_automation_decision',
  BLOCKED_QUESTION_REDUCTION: 'blocked_question_reduction',
});

const POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS = Object.freeze({
  INVALID_RESULT: 'invalid_result',
  UNSUPPORTED_INPUT: 'unsupported_input',
  INVALID_EVIDENCE_ADMISSION: 'invalid_evidence_admission',
  INVALID_AUTOMATION_DECISION: 'invalid_automation_decision',
  INVALID_QUESTION_REDUCTION: 'invalid_question_reduction',
  RAW_RUNTIME_INPUT_EXPOSED: 'raw_runtime_input_exposed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'task',
  'runtimeEvidenceInput',
  'routing',
  'classification',
  'policyEvaluation',
]);

const ALLOWED_RESULT_KEYS = Object.freeze([
  'version',
  'ok',
  'statusId',
  'reasonCode',
  'queueQuestionReduction',
  'sideEffects',
  'audit',
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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOnlyAllowedKeys(value, allowedKeys) {
  return Object.keys(asObject(value)).every(key => allowedKeys.includes(key));
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

function hasExpectedSideEffects(sideEffects = {}) {
  const reported = asObject(sideEffects);

  return JSON.stringify(Object.keys(reported).sort()) === JSON.stringify([...SIDE_EFFECT_IDS].sort()) &&
    SIDE_EFFECT_IDS.every(sideEffectId => reported[sideEffectId] === false);
}

function buildResult({
  statusId,
  reasonCode,
  queueQuestionReduction = null,
} = {}) {
  const result = {
    version: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_VERSION,
    ok: statusId === POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.READY,
    statusId,
    reasonCode,
    queueQuestionReduction,
    sideEffects: buildSideEffects(),
  };

  return {
    ...result,
    audit: buildPolicyRuntimeQueueQuestionReductionProducerAudit(result),
  };
}

function buildBlockedResult(statusId, reasonCode) {
  return buildResult({ statusId, reasonCode });
}

function isReadyEvidenceAdmission(result = {}) {
  const candidate = asObject(result);

  return candidate.statusId === POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.READY &&
    candidate.ok === true &&
    buildPolicyRuntimeQueueEvidenceAdmissionAudit(candidate).ok === true;
}

function isReadyAutomationDecision(result = {}) {
  const candidate = asObject(result);

  return candidate.statusId === POLICY_RUNTIME_QUEUE_AUTOMATION_DECISION_STATUS_IDS.READY &&
    candidate.ok === true &&
    buildPolicyRuntimeQueueAutomationDecisionAudit(candidate).ok === true;
}

function isReadyQuestionReduction(result = {}) {
  const candidate = asObject(result);

  return candidate.statusId === POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY &&
    candidate.ok === true &&
    buildPolicyRuntimeQueueQuestionReductionAudit(candidate).ok === true;
}

function buildPolicyRuntimeQueueQuestionReductionProducer(input = {}) {
  const request = asObject(input);

  if (!hasOnlyAllowedKeys(request, ALLOWED_INPUT_KEYS)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.UNSUPPORTED_INPUT
    );
  }

  const evidenceAdmission = buildPolicyRuntimeQueueEvidenceAdmission({
    task: request.task,
    runtimeEvidenceInput: request.runtimeEvidenceInput,
  });
  if (!isReadyEvidenceAdmission(evidenceAdmission)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.BLOCKED_EVIDENCE_ADMISSION,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.INVALID_EVIDENCE_ADMISSION
    );
  }

  const queueAutomationDecision = buildPolicyRuntimeQueueAutomationDecision({
    evidenceAdmission,
    routing: request.routing,
    classification: request.classification,
    policyEvaluation: request.policyEvaluation,
  });
  if (!isReadyAutomationDecision(queueAutomationDecision)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.BLOCKED_AUTOMATION_DECISION,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.INVALID_AUTOMATION_DECISION
    );
  }

  const queueQuestionReduction = buildPolicyRuntimeQueueQuestionReduction({
    queueAutomationDecision,
  });
  if (!isReadyQuestionReduction(queueQuestionReduction)) {
    return buildBlockedResult(
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.BLOCKED_QUESTION_REDUCTION,
      POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.INVALID_QUESTION_REDUCTION
    );
  }

  return buildResult({
    statusId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.READY,
    reasonCode: 'current_queue_evidence_reduced',
    queueQuestionReduction,
  });
}

function buildPolicyRuntimeQueueQuestionReductionProducerAudit(result = {}) {
  const candidate = asObject(result);
  const issues = [];
  const isReady = candidate.statusId ===
    POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS.READY;

  if (
    candidate.version !== POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_VERSION ||
    !Object.values(POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS)
      .includes(candidate.statusId) ||
    typeof candidate.reasonCode !== 'string' ||
    !candidate.reasonCode
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.INVALID_RESULT,
      message: 'Queue question-reduction producers must use a supported version, status, and reason code.',
    });
  }

  if (!hasOnlyAllowedKeys(candidate, ALLOWED_RESULT_KEYS)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.RAW_RUNTIME_INPUT_EXPOSED,
      message: 'Queue question-reduction producers cannot expose raw task or runtime evidence inputs.',
    });
  }

  if (!hasExpectedSideEffects(candidate.sideEffects)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Queue question-reduction production must remain side-effect-free.',
    });
  }

  if (isReady) {
    if (candidate.ok !== true || !isReadyQuestionReduction(candidate.queueQuestionReduction)) {
      issues.push({
        riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.INVALID_QUESTION_REDUCTION,
        message: 'A ready queue question-reduction producer requires a valid opaque queue question-reduction result.',
      });
    }
  } else if (candidate.ok === true || candidate.queueQuestionReduction !== null) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS.INVALID_RESULT,
      message: 'A blocked queue question-reduction producer cannot expose usable queue proof.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_RISK_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_PRODUCER_VERSION,
  buildPolicyRuntimeQueueQuestionReductionProducer,
  buildPolicyRuntimeQueueQuestionReductionProducerAudit,
};
