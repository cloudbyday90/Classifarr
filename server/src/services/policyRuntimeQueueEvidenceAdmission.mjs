import { createHash } from 'node:crypto';

import {
  buildPolicyRuntimeEvidenceProjection,
  buildPolicyRuntimeEvidenceProjectionAudit,
  validatePolicyRuntimeEvidenceProjection,
} from './policyRuntimeEvidenceProjection.mjs';

const POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_VERSION =
  'policy.runtime_queue_evidence_admission.v1';

const POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_INVALID_QUEUE_TASK: 'blocked_invalid_queue_task',
  BLOCKED_CACHED_PROJECTION: 'blocked_cached_projection',
  BLOCKED_UNSUPPORTED_EVIDENCE_INPUT: 'blocked_unsupported_evidence_input',
  BLOCKED_INVALID_EVIDENCE: 'blocked_invalid_evidence',
});

const POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS = Object.freeze({
  INVALID_QUEUE_TASK: 'invalid_queue_task',
  UNSUPPORTED_QUEUE_TASK_TYPE: 'unsupported_queue_task_type',
  INVALID_QUEUE_ATTEMPT: 'invalid_queue_attempt',
  CACHED_EVIDENCE_PROJECTION: 'cached_evidence_projection',
  UNSUPPORTED_EVIDENCE_INPUT: 'unsupported_evidence_input',
  INVALID_EVIDENCE_PROJECTION: 'invalid_evidence_projection',
  READY_WITHOUT_VALID_EVIDENCE: 'ready_without_valid_evidence',
  BLOCKED_WITH_EVIDENCE: 'blocked_with_evidence',
  INVALID_EXECUTION_FINGERPRINT: 'invalid_execution_fingerprint',
  RAW_QUEUE_PAYLOAD_EXPOSED: 'raw_queue_payload_exposed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const ALLOWED_RUNTIME_EVIDENCE_INPUT_KEYS = Object.freeze([
  'libraryProfile',
  'operatorIntent',
  'classificationFinalOutcomes',
  'manualCorrections',
  'pendingItemAnswers',
  'ragNeighbors',
  'ragEvidence',
  'metadataSignals',
  'metadataEvidence',
  'routingOutcomes',
  'profileFreshness',
]);

const CACHED_PROJECTION_INPUT_KEYS = Object.freeze([
  'evidenceProjection',
  'projectionFingerprint',
  'automationDecision',
]);

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

const ALLOWED_QUEUE_CONTEXT_KEYS = Object.freeze([
  'taskType',
  'attempt',
  'taskFingerprint',
]);

const ALLOWED_READY_EVIDENCE_KEYS = Object.freeze([
  'projection',
  'fingerprint',
  'executionFingerprint',
  'issueCount',
]);

const ALLOWED_BLOCKED_EVIDENCE_KEYS = Object.freeze([
  'issueCount',
  'riskIds',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 120) {
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
  if (Array.isArray(value)) {
    return value.map(item => stableValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce((result, key) => ({
      ...result,
      [key]: stableValue(value[key]),
    }), {});
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildQueueContext(task = {}) {
  const queueTask = asObject(task);
  const taskId = normalizeString(queueTask.id, 160);
  const taskType = normalizeString(
    queueTask.task_type ?? queueTask.taskType,
    48
  ).toLowerCase();
  const attempt = normalizeAttempt(queueTask.attempts);

  return {
    valid: Boolean(taskId) && taskType === 'classification' && attempt !== null,
    taskType,
    attempt,
    taskFingerprint: taskId ? sha256(taskId) : null,
  };
}

function buildExecutionFingerprint({ queueContext = {}, evidenceFingerprint = null } = {}) {
  return sha256(JSON.stringify(stableValue({
    version: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_VERSION,
    taskFingerprint: queueContext.taskFingerprint || null,
    taskType: queueContext.taskType || null,
    attempt: queueContext.attempt ?? null,
    evidenceFingerprint: evidenceFingerprint || null,
  })));
}

function buildCurrentRuntimeEvidenceInput(value = {}) {
  const input = asObject(value);

  return {
    libraryProfile: input.libraryProfile,
    operatorIntent: input.operatorIntent,
    classificationFinalOutcomes: input.classificationFinalOutcomes,
    manualCorrections: input.manualCorrections,
    pendingItemAnswers: input.pendingItemAnswers,
    ragNeighbors: input.ragNeighbors,
    ragEvidence: input.ragEvidence,
    metadataSignals: input.metadataSignals,
    metadataEvidence: input.metadataEvidence,
    routingOutcomes: input.routingOutcomes,
    profileFreshness: input.profileFreshness,
  };
}

function collectEvidenceInputRiskIds(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      cachedProjectionKey: null,
      unsupportedInputKeys: ['runtime_evidence_input_not_object'],
    };
  }

  const input = asObject(value);
  const inputKeys = Object.keys(input);
  const cachedProjectionKey = CACHED_PROJECTION_INPUT_KEYS.find(key =>
    Object.hasOwn(input, key)
  );
  const unsupportedInputKeys = inputKeys.filter(key =>
    !ALLOWED_RUNTIME_EVIDENCE_INPUT_KEYS.includes(key) &&
    !CACHED_PROJECTION_INPUT_KEYS.includes(key)
  );

  return {
    cachedProjectionKey: cachedProjectionKey || null,
    unsupportedInputKeys,
  };
}

function buildSideEffects() {
  return {
    providerCalled: false,
    queueMutated: false,
    classificationExecuted: false,
    routingExecuted: false,
    learningWritten: false,
  };
}

function hasOnlyAllowedKeys(value, allowedKeys) {
  return Object.keys(asObject(value)).every(key => allowedKeys.includes(key));
}

function buildResult({
  ok,
  statusId,
  queueContext,
  reasonCode,
  evidence = null,
} = {}) {
  const result = {
    version: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_VERSION,
    ok: ok === true,
    statusId,
    reasonCode,
    queueContext: {
      taskType: queueContext?.taskType || null,
      attempt: queueContext?.attempt ?? null,
      taskFingerprint: queueContext?.taskFingerprint || null,
    },
    evidence,
    sideEffects: buildSideEffects(),
  };

  return {
    ...result,
    audit: buildPolicyRuntimeQueueEvidenceAdmissionAudit(result),
  };
}

function buildBlockedResult({ queueContext, statusId, reasonCode, evidence = null } = {}) {
  return buildResult({
    ok: false,
    statusId,
    queueContext,
    reasonCode,
    evidence,
  });
}

function buildPolicyRuntimeQueueEvidenceAdmission({
  task = {},
  runtimeEvidenceInput = {},
} = {}) {
  const queueContext = buildQueueContext(task);

  if (!queueContext.taskFingerprint || !queueContext.taskType) {
    return buildBlockedResult({
      queueContext,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED_INVALID_QUEUE_TASK,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_QUEUE_TASK,
    });
  }

  if (queueContext.taskType !== 'classification') {
    return buildBlockedResult({
      queueContext,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED_INVALID_QUEUE_TASK,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.UNSUPPORTED_QUEUE_TASK_TYPE,
    });
  }

  if (queueContext.attempt === null) {
    return buildBlockedResult({
      queueContext,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED_INVALID_QUEUE_TASK,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_QUEUE_ATTEMPT,
    });
  }

  const inputRisks = collectEvidenceInputRiskIds(runtimeEvidenceInput);
  if (inputRisks.cachedProjectionKey) {
    return buildBlockedResult({
      queueContext,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED_CACHED_PROJECTION,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.CACHED_EVIDENCE_PROJECTION,
    });
  }

  if (inputRisks.unsupportedInputKeys.length > 0) {
    return buildBlockedResult({
      queueContext,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS
        .BLOCKED_UNSUPPORTED_EVIDENCE_INPUT,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.UNSUPPORTED_EVIDENCE_INPUT,
    });
  }

  const projection = buildPolicyRuntimeEvidenceProjection(
    buildCurrentRuntimeEvidenceInput(runtimeEvidenceInput)
  );
  const projectionAudit = buildPolicyRuntimeEvidenceProjectionAudit(projection);

  if (projectionAudit.ok !== true) {
    return buildBlockedResult({
      queueContext,
      statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.BLOCKED_INVALID_EVIDENCE,
      reasonCode: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_EVIDENCE_PROJECTION,
      evidence: {
        fingerprint: null,
        issueCount: projectionAudit.issueCount,
        riskIds: projectionAudit.validation.issues.map(issue => issue.riskId),
      },
    });
  }

  const evidenceFingerprint = projection.projectionFingerprint?.fingerprint || null;
  const executionFingerprint = buildExecutionFingerprint({
    queueContext,
    evidenceFingerprint,
  });

  return buildResult({
    ok: true,
    statusId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.READY,
    queueContext,
    reasonCode: 'current_runtime_evidence_projected',
    evidence: {
      projection,
      fingerprint: evidenceFingerprint,
      executionFingerprint,
      issueCount: projectionAudit.issueCount,
    },
  });
}

function buildPolicyRuntimeQueueEvidenceAdmissionAudit(result = {}) {
  const admission = asObject(result);
  const issues = [];
  const allowedStatusIds = new Set(
    Object.values(POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS)
  );
  const queueContext = asObject(admission.queueContext);
  const evidence = asObject(admission.evidence);
  const projection = evidence.projection;

  if (admission.version !== POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_VERSION ||
      !allowedStatusIds.has(admission.statusId)) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_QUEUE_TASK,
      message: 'Queue evidence admission must use a supported contract version and status.',
    });
  }

  if (
    admission.statusId === POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.READY &&
    (
      queueContext.taskType !== 'classification' ||
      !Number.isInteger(queueContext.attempt) ||
      queueContext.attempt < 0 ||
      !SHA256_HEX_PATTERN.test(queueContext.taskFingerprint || '')
    )
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_QUEUE_TASK,
      message: 'Queue evidence admission must retain only a valid bounded classification-task context.',
    });
  }

  if (admission.statusId === POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.READY) {
    const projectionValidation = validatePolicyRuntimeEvidenceProjection(projection);
    const projectionFingerprint = projection?.projectionFingerprint?.fingerprint || null;
    const expectedExecutionFingerprint = buildExecutionFingerprint({
      queueContext,
      evidenceFingerprint: evidence.fingerprint,
    });

    if (admission.ok !== true || projectionValidation.ok !== true ||
        !SHA256_HEX_PATTERN.test(evidence.fingerprint || '') ||
        evidence.fingerprint !== projectionFingerprint) {
      issues.push({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.READY_WITHOUT_VALID_EVIDENCE,
        message: 'A ready queue evidence admission requires a valid fresh evidence projection.',
      });
    }

    if (evidence.executionFingerprint !== expectedExecutionFingerprint) {
      issues.push({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.INVALID_EXECUTION_FINGERPRINT,
        message: 'Queue evidence admission execution fingerprint must bind the task context and evidence fingerprint.',
      });
    }
  } else if (
    admission.ok === true ||
    projection ||
    evidence.fingerprint ||
    evidence.executionFingerprint
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.BLOCKED_WITH_EVIDENCE,
      message: 'A blocked queue evidence admission cannot expose a usable evidence projection.',
    });
  }

  if (
    !hasOnlyAllowedKeys(queueContext, ALLOWED_QUEUE_CONTEXT_KEYS) ||
    !hasOnlyAllowedKeys(
      evidence,
      admission.statusId === POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS.READY
        ? ALLOWED_READY_EVIDENCE_KEYS
        : ALLOWED_BLOCKED_EVIDENCE_KEYS
    ) ||
    Object.hasOwn(admission, 'task') ||
    Object.hasOwn(admission, 'payload')
  ) {
    issues.push({
      riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.RAW_QUEUE_PAYLOAD_EXPOSED,
      message: 'Queue evidence admission cannot expose unsupported queue identifiers, payloads, or evidence fields.',
    });
  }

  Object.entries(asObject(admission.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true) {
      issues.push({
        riskId: POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Queue evidence admission must not perform workflow side effects.',
        sideEffectId,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_RISK_IDS,
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_STATUS_IDS,
  POLICY_RUNTIME_QUEUE_EVIDENCE_ADMISSION_VERSION,
  buildPolicyRuntimeQueueEvidenceAdmission,
  buildPolicyRuntimeQueueEvidenceAdmissionAudit,
};
