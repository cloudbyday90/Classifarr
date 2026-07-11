const POLICY_RUNTIME_METRICS_INPUT_VERSION = 'policy.runtime_metrics_input.v1';

const METRICS_INPUT_FIELDS = new Set([
  'version',
  'automationDecisions',
  'questionReductions',
  'requestLearningDecisions',
  'rebuildProposals',
  'migrationVerifierReports',
  'rebuildEvents',
]);
const TRACE_FIELDS = new Set([
  'reasons',
  'attributes',
]);
const SOURCE_FINGERPRINT_ATTRIBUTE_IDS = new Set([
  'classifarr.runtime.decision.evidence_projection_fingerprint',
  'classifarr.runtime.question.decision_evidence_projection_fingerprint',
  'classifarr.runtime.request_learning.upstream_evidence_fingerprint',
  'classifarr.policy.migration_verifier.sample_set_fingerprint',
]);
const SENSITIVE_KEYS = Object.freeze([
  'prompt',
  'systemPrompt',
  'userPrompt',
  'embedding',
  'embeddings',
  'vector',
  'providerPayload',
  'raw',
  'rawPayload',
  'payload',
  'impactPreview',
  'replayPreview',
  'replayParity',
  'providerReadiness',
  'tmdbCoverage',
  'rawScoring',
]);
const MAX_TRACE_REASONS = 12;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asSafeCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasOwnKeyDeep(value, keys) {
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value).some(([key, child]) =>
    keys.includes(key) || hasOwnKeyDeep(child, keys)
  );
}

function normalizeTrace(value = {}) {
  const trace = asObject(value);
  const attributes = asObject(trace.attributes);

  return {
    reasons: asArray(trace.reasons)
      .map(reason => normalizeString(reason?.reasonId))
      .filter(Boolean)
      .slice(0, MAX_TRACE_REASONS)
      .map(reasonId => ({ reasonId })),
    attributes: Object.fromEntries(
      [...SOURCE_FINGERPRINT_ATTRIBUTE_IDS]
        .filter(attributeId => typeof attributes[attributeId] === 'string')
        .map(attributeId => [attributeId, normalizeString(attributes[attributeId]).toLowerCase()])
    ),
  };
}

function normalizeGuardedOutcomes(value = {}) {
  const guardedOutcomes = asObject(value);

  return {
    fingerprintCount: asSafeCount(guardedOutcomes.fingerprintCount),
    missingFingerprintCount: asSafeCount(guardedOutcomes.missingFingerprintCount),
    requestProofCount: asSafeCount(guardedOutcomes.requestProofCount),
    missingRequestProofCount: asSafeCount(guardedOutcomes.missingRequestProofCount),
    invalidRequestProofCount: asSafeCount(guardedOutcomes.invalidRequestProofCount),
    fingerprints: asArray(guardedOutcomes.fingerprints)
      .map(fingerprint => normalizeString(fingerprint).toLowerCase())
      .filter(Boolean),
  };
}

function normalizeAutomationDecision(source = {}) {
  return {
    stateId: normalizeString(source.stateId),
    trace: normalizeTrace(source.trace),
    sensitiveInputDetected: hasOwnKeyDeep(source, SENSITIVE_KEYS),
  };
}

function normalizeQuestionReduction(source = {}) {
  return {
    dispositionId: normalizeString(source.dispositionId),
    trace: normalizeTrace(source.trace),
    sensitiveInputDetected: hasOwnKeyDeep(source, SENSITIVE_KEYS),
  };
}

function normalizeRequestLearningDecision(source = {}) {
  return {
    dispositionId: normalizeString(source.dispositionId),
    trace: normalizeTrace(source.trace),
    sensitiveInputDetected: hasOwnKeyDeep(source, SENSITIVE_KEYS),
  };
}

function normalizeRebuildProposal(source = {}) {
  return {
    statusId: normalizeString(source.statusId),
    acceptanceGate: {
      accepted: source.acceptanceGate?.accepted === true,
    },
    evidenceSourceSummary: {
      guardedOutcomes: normalizeGuardedOutcomes(source.evidenceSourceSummary?.guardedOutcomes),
    },
    trace: normalizeTrace(source.trace),
    sensitiveInputDetected: hasOwnKeyDeep(source, SENSITIVE_KEYS),
  };
}

function normalizeMigrationVerifierReport(source = {}) {
  return {
    statusId: normalizeString(source.statusId),
    applicationGate: {
      operatorAccepted: source.applicationGate?.operatorAccepted === true,
    },
    trace: normalizeTrace(source.trace),
    sensitiveInputDetected: hasOwnKeyDeep(source, SENSITIVE_KEYS),
  };
}

function normalizeRebuildEvent(source = {}) {
  return {
    statusId: normalizeString(source.statusId ?? source.status),
    trace: normalizeTrace(source.trace),
    sensitiveInputDetected: hasOwnKeyDeep(source, SENSITIVE_KEYS),
  };
}

function buildPolicyRuntimeMetricsInputFromRuntimeInput(input = {}) {
  const runtimeInput = asObject(input);

  return {
    version: POLICY_RUNTIME_METRICS_INPUT_VERSION,
    automationDecisions: asArray(runtimeInput.automationDecisions).map(normalizeAutomationDecision),
    questionReductions: asArray(runtimeInput.questionReductions).map(normalizeQuestionReduction),
    requestLearningDecisions: asArray(runtimeInput.requestLearningDecisions)
      .map(normalizeRequestLearningDecision),
    rebuildProposals: asArray(runtimeInput.rebuildProposals).map(normalizeRebuildProposal),
    migrationVerifierReports: asArray(runtimeInput.migrationVerifierReports)
      .map(normalizeMigrationVerifierReport),
    rebuildEvents: asArray(runtimeInput.rebuildEvents).map(normalizeRebuildEvent),
  };
}

function hasOnlyFields(value = {}, fields = new Set()) {
  return Object.keys(asObject(value)).every(field => fields.has(field));
}

function validateTrace(trace = {}) {
  const normalizedTrace = asObject(trace);
  const attributes = asObject(normalizedTrace.attributes);

  return hasOnlyFields(normalizedTrace, TRACE_FIELDS) &&
    Array.isArray(normalizedTrace.reasons) &&
    normalizedTrace.reasons.length <= MAX_TRACE_REASONS &&
    normalizedTrace.reasons.every(reason =>
      hasOnlyFields(reason, new Set(['reasonId'])) && Boolean(normalizeString(reason.reasonId))
    ) &&
    Object.entries(attributes).every(([attributeId, value]) =>
      SOURCE_FINGERPRINT_ATTRIBUTE_IDS.has(attributeId) && typeof value === 'string'
    );
}

function validateSource(source = {}, fields = new Set()) {
  const normalizedSource = asObject(source);

  return hasOnlyFields(normalizedSource, fields) &&
    typeof normalizedSource.sensitiveInputDetected === 'boolean' &&
    validateTrace(normalizedSource.trace);
}

function validatePolicyRuntimeMetricsInput(input = {}) {
  const metricsInput = asObject(input);
  const issues = [];

  if (metricsInput.version !== POLICY_RUNTIME_METRICS_INPUT_VERSION) {
    issues.push({ field: 'version', message: 'Metrics input must use the current contract version.' });
  }
  if (!hasOnlyFields(metricsInput, METRICS_INPUT_FIELDS)) {
    issues.push({ field: 'input', message: 'Metrics input contains unsupported raw fields.' });
  }

  const sourceDefinitions = [
    ['automationDecisions', new Set(['stateId', 'trace', 'sensitiveInputDetected'])],
    ['questionReductions', new Set(['dispositionId', 'trace', 'sensitiveInputDetected'])],
    ['requestLearningDecisions', new Set(['dispositionId', 'trace', 'sensitiveInputDetected'])],
    ['rebuildProposals', new Set([
      'statusId', 'acceptanceGate', 'evidenceSourceSummary', 'trace', 'sensitiveInputDetected',
    ])],
    ['migrationVerifierReports', new Set([
      'statusId', 'applicationGate', 'trace', 'sensitiveInputDetected',
    ])],
    ['rebuildEvents', new Set(['statusId', 'trace', 'sensitiveInputDetected'])],
  ];

  for (const [field, allowedFields] of sourceDefinitions) {
    if (!Array.isArray(metricsInput[field])) {
      issues.push({ field, message: 'Metrics input must contain normalized source arrays.' });
      continue;
    }

    metricsInput[field].forEach((source, index) => {
      if (!validateSource(source, allowedFields)) {
        issues.push({ field: `${field}[${index}]`, message: 'Metrics input contains an invalid normalized source.' });
      }
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_RUNTIME_METRICS_INPUT_VERSION,
  buildPolicyRuntimeMetricsInputFromRuntimeInput,
  validatePolicyRuntimeMetricsInput,
};
