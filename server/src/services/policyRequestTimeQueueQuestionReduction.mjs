/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

import {
  POLICY_REQUEST_EVENT_TYPE_IDS,
  buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan,
  validatePolicyRequestTimeLearningDecision,
} from './policyRequestTimeLearning.mjs';
import {
  validatePolicyRequestTimeEvent,
} from './policyRequestTimeEvent.mjs';
import {
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_VERSION,
  buildPolicyRuntimeQueueQuestionReductionAudit,
} from './policyRuntimeQueueQuestionReduction.mjs';
import {
  validatePolicyRuntimeQuestionReduction,
} from './policyRuntimeQuestionReduction.mjs';

const POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_VERSION =
  'policy.request_time_queue_question_reduction.v1';

const POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_UNSUPPORTED_INPUT: 'blocked_unsupported_input',
  BLOCKED_INVALID_QUEUE_TASK: 'blocked_invalid_queue_task',
  BLOCKED_INVALID_QUEUE_QUESTION_REDUCTION: 'blocked_invalid_queue_question_reduction',
  BLOCKED_INVALID_REQUEST_EVENT: 'blocked_invalid_request_event',
  BLOCKED_INVALID_REQUEST_TIME_DECISION: 'blocked_invalid_request_time_decision',
});

const POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS = Object.freeze({
  INVALID_RESULT: 'invalid_result',
  UNSUPPORTED_INPUT: 'unsupported_input',
  INVALID_QUEUE_TASK: 'invalid_queue_task',
  INVALID_QUEUE_EVIDENCE_BINDING: 'invalid_queue_evidence_binding',
  INVALID_QUEUE_QUESTION_REDUCTION: 'invalid_queue_question_reduction',
  INVALID_REQUEST_EVENT: 'invalid_request_event',
  INVALID_REQUEST_TIME_DECISION: 'invalid_request_time_decision',
  EVIDENCE_FINGERPRINT_MISMATCH: 'evidence_fingerprint_mismatch',
  RAW_QUEUE_DATA_EXPOSED: 'raw_queue_data_exposed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const ALLOWED_INPUT_KEYS = Object.freeze([
  'queueQuestionReduction',
  'queueTaskContext',
  'requestEvent',
]);

const ALLOWED_QUEUE_TASK_CONTEXT_KEYS = Object.freeze([
  'id',
  'taskType',
  'attempts',
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
  'questionPersisted',
  'questionSent',
  'learningWritten',
  'profileRefreshQueued',
]);

const TERMINAL_ROUTE_EVENT_TYPE_IDS = new Set([
  POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_SUCCEEDED,
  POLICY_REQUEST_EVENT_TYPE_IDS.ROUTE_FAILED_MISSING_MAPPING,
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
const QUEUE_EVIDENCE_ADMISSION_VERSION = 'policy.runtime_queue_evidence_admission.v1';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeAttempt(value) {
  if (value === undefined || value === null || value === '') return 0;

  const attempt = Number(value);
  return Number.isInteger(attempt) && attempt >= 0 ? attempt : null;
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

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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
    profileRefreshQueued: false,
  };
}

function buildQueueTaskBinding(value = {}) {
  const context = asObject(value);
  const taskId = normalizeString(context.id, 160);
  const taskType = normalizeString(context.taskType, 48).toLowerCase();
  const attempt = normalizeAttempt(context.attempts);

  return {
    taskType,
    attempt,
    taskFingerprint: taskId ? sha256(taskId) : null,
  };
}

function buildExecutionFingerprint({ queueTaskBinding = {}, evidenceFingerprint = null } = {}) {
  return sha256(JSON.stringify(stableValue({
    version: QUEUE_EVIDENCE_ADMISSION_VERSION,
    taskFingerprint: queueTaskBinding.taskFingerprint || null,
    taskType: queueTaskBinding.taskType || null,
    attempt: queueTaskBinding.attempt ?? null,
    evidenceFingerprint: evidenceFingerprint || null,
  })));
}

function buildQueueEvidenceBinding(queueQuestionReduction = {}) {
  const queueEvidence = asObject(queueQuestionReduction.queueEvidence);

  return {
    taskType: normalizeString(queueEvidence.taskType, 48) || null,
    attempt: Number.isInteger(queueEvidence.attempt) ? queueEvidence.attempt : null,
    taskFingerprint: normalizeString(queueEvidence.taskFingerprint, 80) || null,
    evidenceFingerprint: normalizeString(queueEvidence.evidenceFingerprint, 80) || null,
    executionFingerprint: normalizeString(queueEvidence.executionFingerprint, 80) || null,
  };
}

function isValidQueueEvidenceBinding(queueEvidence = {}) {
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

function buildReadyQueueQuestionReduction({ queueQuestionReduction, queueTaskContext }) {
  const source = asObject(queueQuestionReduction);
  const sourceAudit = buildPolicyRuntimeQueueQuestionReductionAudit(source);
  const queueTask = asObject(queueTaskContext);

  if (!hasOnlyAllowedKeys(queueTask, ALLOWED_QUEUE_TASK_CONTEXT_KEYS)) return null;
  if (
    source.version !== POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_VERSION ||
    source.ok !== true ||
    source.statusId !== POLICY_RUNTIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY ||
    sourceAudit.ok !== true
  ) {
    return null;
  }

  const queueTaskBinding = buildQueueTaskBinding(queueTask);
  const queueEvidence = buildQueueEvidenceBinding(source);
  const plan = asObject(source.plan);
  const planValidation = validatePolicyRuntimeQuestionReduction(plan);
  const expectedExecutionFingerprint = buildExecutionFingerprint({
    queueTaskBinding,
    evidenceFingerprint: queueEvidence.evidenceFingerprint,
  });

  if (
    queueTaskBinding.taskType !== 'classification' ||
    queueTaskBinding.attempt === null ||
    !queueTaskBinding.taskFingerprint ||
    !isValidQueueEvidenceBinding(queueEvidence) ||
    queueEvidence.taskType !== queueTaskBinding.taskType ||
    queueEvidence.attempt !== queueTaskBinding.attempt ||
    queueEvidence.taskFingerprint !== queueTaskBinding.taskFingerprint ||
    queueEvidence.executionFingerprint !== expectedExecutionFingerprint ||
    planValidation.ok !== true ||
    plan.decisionEvidenceFingerprint?.fingerprint !== queueEvidence.evidenceFingerprint
  ) {
    return null;
  }

  return {
    queueEvidence,
    plan,
  };
}

function buildResult({
  ok,
  statusId,
  reasonCode,
  queueEvidence = null,
  decision = null,
} = {}) {
  const result = {
    version: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_VERSION,
    ok: ok === true,
    statusId,
    reasonCode,
    queueEvidence,
    decision,
    sideEffects: buildSideEffects(),
  };

  return {
    ...result,
    audit: buildPolicyRequestTimeQueueQuestionReductionAudit(result),
  };
}

function buildBlockedResult(statusId, reasonCode) {
  return buildResult({
    ok: false,
    statusId,
    reasonCode,
  });
}

function buildPolicyRequestTimeQueueQuestionReduction(input = {}) {
  const request = asObject(input);

  if (!hasOnlyAllowedKeys(request, ALLOWED_INPUT_KEYS)) {
    return buildBlockedResult(
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSUPPORTED_INPUT
    );
  }

  const queueTaskContext = asObject(request.queueTaskContext);
  if (!hasOnlyAllowedKeys(queueTaskContext, ALLOWED_QUEUE_TASK_CONTEXT_KEYS)) {
    return buildBlockedResult(
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_UNSUPPORTED_INPUT,
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSUPPORTED_INPUT
    );
  }

  const queueTaskBinding = buildQueueTaskBinding(queueTaskContext);
  if (
    queueTaskBinding.taskType !== 'classification' ||
    queueTaskBinding.attempt === null ||
    !queueTaskBinding.taskFingerprint
  ) {
    return buildBlockedResult(
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_INVALID_QUEUE_TASK,
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_TASK
    );
  }

  const readyQueueQuestionReduction = buildReadyQueueQuestionReduction({
    queueQuestionReduction: request.queueQuestionReduction,
    queueTaskContext,
  });
  if (!readyQueueQuestionReduction) {
    return buildBlockedResult(
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS
        .BLOCKED_INVALID_QUEUE_QUESTION_REDUCTION,
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_QUESTION_REDUCTION
    );
  }

  const requestEvent = asObject(request.requestEvent);
  const requestEventValidation = validatePolicyRequestTimeEvent(requestEvent);
  if (
    requestEventValidation.ok !== true ||
    !TERMINAL_ROUTE_EVENT_TYPE_IDS.has(requestEvent.eventTypeId)
  ) {
    return buildBlockedResult(
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.BLOCKED_INVALID_REQUEST_EVENT,
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_EVENT
    );
  }

  let decision;
  try {
    decision = buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan({
      questionReductionPlan: readyQueueQuestionReduction.plan,
      requestEvent,
    });
  } catch {
    return buildBlockedResult(
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS
        .BLOCKED_INVALID_REQUEST_TIME_DECISION,
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_TIME_DECISION
    );
  }

  const decisionValidation = validatePolicyRequestTimeLearningDecision(decision);
  if (
    decisionValidation.ok !== true ||
    decision.upstreamEvidenceFingerprint?.fingerprint !==
      readyQueueQuestionReduction.queueEvidence.evidenceFingerprint
  ) {
    return buildBlockedResult(
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS
        .BLOCKED_INVALID_REQUEST_TIME_DECISION,
      POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_TIME_DECISION
    );
  }

  return buildResult({
    ok: true,
    statusId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY,
    reasonCode: 'queue_question_reduction_admitted_for_terminal_route_outcome',
    queueEvidence: readyQueueQuestionReduction.queueEvidence,
    decision,
  });
}

function buildPolicyRequestTimeQueueQuestionReductionAudit(result = {}) {
  const candidate = asObject(result);
  const issues = [];
  const statusIds = new Set(
    Object.values(POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS)
  );
  const queueEvidence = asObject(candidate.queueEvidence);
  const sideEffects = asObject(candidate.sideEffects);
  const isReady = candidate.statusId === POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS.READY;

  if (
    candidate.version !== POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_VERSION ||
    !statusIds.has(candidate.statusId) ||
    !normalizeString(candidate.reasonCode, 120)
  ) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
      message: 'Queue request-time reductions must use a supported version, status, and reason code.',
    });
  }

  if (!hasOnlyAllowedKeys(candidate, ALLOWED_RESULT_KEYS)) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      message: 'Queue request-time reductions cannot expose unsupported result fields.',
    });
  }

  if (
    !hasOnlyAllowedKeys(queueEvidence, ALLOWED_QUEUE_EVIDENCE_KEYS) ||
    hasUnsafeOutputKey(queueEvidence) ||
    hasUnsafeOutputKey(candidate.decision) ||
    hasUnsafeOutputKey(candidate.audit)
  ) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.RAW_QUEUE_DATA_EXPOSED,
      message: 'Queue request-time reductions cannot expose raw queue or provider data.',
    });
  }

  const hasExpectedSideEffectShape =
    stableJson(Object.keys(sideEffects).sort()) === stableJson([...SIDE_EFFECT_IDS].sort()) &&
    SIDE_EFFECT_IDS.every(sideEffectId => sideEffects[sideEffectId] === false);
  if (!hasExpectedSideEffectShape) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.UNSAFE_SIDE_EFFECT,
      message: 'Queue request-time reduction must remain side-effect-free.',
    });
  }

  if (!isReady) {
    if (candidate.ok === true || candidate.queueEvidence !== null || candidate.decision !== null) {
      issues.push({
        riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
        message: 'Blocked queue request-time reductions cannot expose a usable decision or evidence binding.',
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
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_RESULT,
      message: 'A ready queue request-time reduction requires a request-time decision.',
    });
  }

  if (!isValidQueueEvidenceBinding(queueEvidence)) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_QUEUE_EVIDENCE_BINDING,
      message: 'Ready queue request-time reductions require bounded execution evidence binding.',
    });
  }

  const decisionValidation = validatePolicyRequestTimeLearningDecision(asObject(candidate.decision));
  if (decisionValidation.ok !== true) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_TIME_DECISION,
      message: 'Queue request-time reductions require a valid request-time decision.',
    });
  }

  if (!TERMINAL_ROUTE_EVENT_TYPE_IDS.has(candidate.decision?.eventTypeId)) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.INVALID_REQUEST_EVENT,
      message: 'Queue request-time reductions can admit only terminal routing outcomes.',
    });
  }

  if (candidate.decision?.upstreamEvidenceFingerprint?.fingerprint !== queueEvidence.evidenceFingerprint) {
    issues.push({
      riskId: POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS.EVIDENCE_FINGERPRINT_MISMATCH,
      message: 'Queue evidence and request-time decision fingerprints must match.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS,
  POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS,
  POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_VERSION,
  buildPolicyRequestTimeQueueQuestionReduction,
  buildPolicyRequestTimeQueueQuestionReductionAudit,
};
