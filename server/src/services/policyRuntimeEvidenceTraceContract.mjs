const POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS = Object.freeze({
  VERSION: 'classifarr.runtime.evidence.version',
  ENTRY_COUNT: 'classifarr.runtime.evidence.entry_count',
  WARNING_COUNT: 'classifarr.runtime.evidence.warning_count',
});

const POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS = Object.freeze({
  TRACE_REASON_MISMATCH: 'trace_reason_mismatch',
  WARNING_CONTRACT_MISMATCH: 'warning_contract_mismatch',
});

const POLICY_RUNTIME_EVIDENCE_WARNING_DEFINITIONS = Object.freeze({
  raw_payload_suppressed: Object.freeze({
    reasonCode: 'raw_payload_suppressed',
    message: 'Runtime metadata evidence suppressed a raw provider payload.',
  }),
  operator_intent_boundary_blocked: Object.freeze({
    reasonCode: 'operator_intent_boundary_blocked',
    message: 'Runtime operator intent was excluded because its evidence boundary did not pass validation.',
  }),
  no_runtime_evidence_inputs: Object.freeze({
    bucketId: 'insufficient_evidence',
    reasonCode: 'no_runtime_evidence_inputs',
    message: 'No runtime evidence inputs were provided.',
  }),
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableString(value) {
  return normalizeString(value) || null;
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
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function compareTraceReasons(left, right) {
  return [
    'bucketId',
    'sourceId',
    'runtimeSourceId',
    'reasonCode',
    'demotedFromBucketId',
  ].reduce((result, fieldName) => {
    if (result !== 0) return result;
    return String(left[fieldName] || '').localeCompare(String(right[fieldName] || ''));
  }, 0);
}

function normalizeTraceReason(entry = {}) {
  return {
    bucketId: normalizeNullableString(entry.bucketId),
    sourceId: normalizeNullableString(entry.sourceId),
    runtimeSourceId: normalizeNullableString(entry.runtimeSourceId),
    reasonCode: normalizeNullableString(entry.reasonCode),
    demotedFromBucketId: normalizeNullableString(entry.demotedFromBucketId),
  };
}

function listPolicyRuntimeEvidenceTraceReasons(entries = []) {
  return asArray(entries)
    .map(entry => normalizeTraceReason(isObject(entry) ? entry : {}))
    .sort(compareTraceReasons);
}

function createPolicyRuntimeEvidenceWarning(reasonCode) {
  const definition = POLICY_RUNTIME_EVIDENCE_WARNING_DEFINITIONS[reasonCode];
  return definition ? { ...definition } : null;
}

function buildPolicyRuntimeEvidenceTrace({
  version = null,
  entries = [],
  warnings = [],
} = {}) {
  return {
    attributes: {
      [POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS.VERSION]:
        normalizeNullableString(version),
      [POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS.ENTRY_COUNT]: asArray(entries).length,
      [POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS.WARNING_COUNT]: asArray(warnings).length,
    },
    reasons: listPolicyRuntimeEvidenceTraceReasons(entries),
  };
}

function buildPolicyRuntimeEvidenceTraceAudit({
  trace = {},
  entries = [],
  warnings = [],
} = {}) {
  const issues = [];
  const expectedReasons = listPolicyRuntimeEvidenceTraceReasons(entries);
  const actualReasons = asArray(trace?.reasons);

  if (stableJson(actualReasons) !== stableJson(expectedReasons)) {
    issues.push({
      riskId: POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS.TRACE_REASON_MISMATCH,
      message: 'Runtime evidence trace reasons must exactly reflect sanitized evidence entries.',
    });
  }

  asArray(warnings).forEach(warning => {
    const actualWarning = isObject(warning) ? warning : {};
    const expectedWarning = createPolicyRuntimeEvidenceWarning(
      normalizeString(actualWarning.reasonCode)
    );

    if (!expectedWarning || stableJson(actualWarning) !== stableJson(expectedWarning)) {
      issues.push({
        riskId: POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS.WARNING_CONTRACT_MISMATCH,
        message: 'Runtime evidence warnings must use the bounded server-owned warning contract.',
      });
    }
  });

  return {
    ok: issues.length === 0,
    issues,
  };
}

export {
  POLICY_RUNTIME_EVIDENCE_TRACE_ATTRIBUTE_IDS,
  POLICY_RUNTIME_EVIDENCE_TRACE_RISK_IDS,
  createPolicyRuntimeEvidenceWarning,
  buildPolicyRuntimeEvidenceTrace,
  buildPolicyRuntimeEvidenceTraceAudit,
  listPolicyRuntimeEvidenceTraceReasons,
};
