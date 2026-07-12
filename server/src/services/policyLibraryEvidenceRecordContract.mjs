import {
  buildPolicyEvidenceEntryAudit,
} from './policyEvidenceEntryNormalizer.mjs';

const POLICY_LIBRARY_EVIDENCE_RECORD_FIELD_IDS = Object.freeze([
  'key',
  'label',
  'value',
  'count',
  'confidence',
  'observedAt',
  'reasonCode',
]);

const POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS = Object.freeze({
  MISSING_FIELD: 'missing_library_evidence_record_field',
  UNEXPECTED_FIELD: 'unexpected_library_evidence_record_field',
  INVALID_ENTRY: 'invalid_library_evidence_record',
  INVALID_COUNT: 'invalid_library_evidence_record_count',
  INVALID_CONFIDENCE: 'invalid_library_evidence_record_confidence',
  UNSUPPORTED_REASON_CODE: 'unsupported_library_evidence_record_reason_code',
});

const ALLOWED_FIELD_IDS = new Set(POLICY_LIBRARY_EVIDENCE_RECORD_FIELD_IDS);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildPolicyLibraryEvidenceRecordAudit(entry = {}, {
  allowedReasonCodes = [],
} = {}) {
  const record = asPlainObject(entry);
  const issues = [];
  const entryAudit = buildPolicyEvidenceEntryAudit(record);
  const allowedReasons = new Set(asArray(allowedReasonCodes));

  POLICY_LIBRARY_EVIDENCE_RECORD_FIELD_IDS.forEach(fieldId => {
    if (!Object.prototype.hasOwnProperty.call(record, fieldId)) {
      issues.push({
        riskId: POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.MISSING_FIELD,
        message: 'Library evidence records must include every bounded primitive field.',
        fieldId,
      });
    }
  });

  Object.keys(record).forEach(fieldId => {
    if (!ALLOWED_FIELD_IDS.has(fieldId)) {
      issues.push({
        riskId: POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.UNEXPECTED_FIELD,
        message: 'Library evidence records must not carry fields outside the bounded contract.',
        fieldId,
      });
    }
  });

  if (!entryAudit.ok) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.INVALID_ENTRY,
      message: 'Library evidence records must satisfy the shared evidence entry contract.',
      entryRiskIds: entryAudit.issues.map(issue => issue.riskId),
    });
  }

  if (!Number.isInteger(record.count) || record.count < 0) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.INVALID_COUNT,
      message: 'Library evidence record counts must be non-negative integers.',
    });
  }

  if (record.confidence !== null &&
      (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1)) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.INVALID_CONFIDENCE,
      message: 'Library evidence record confidence must be null or a number from zero through one.',
    });
  }

  if (!allowedReasons.has(record.reasonCode)) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS.UNSUPPORTED_REASON_CODE,
      message: 'Library evidence record reason code must be owned by its source collector.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyLibraryEvidenceRecordCollectionAudit(records = [], options = {}) {
  const issues = [];

  asArray(records).forEach((record, index) => {
    const recordAudit = buildPolicyLibraryEvidenceRecordAudit(record, options);

    recordAudit.issues.forEach(issue => {
      issues.push({
        ...issue,
        index,
      });
    });
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    checkedRecordCount: asArray(records).length,
    issues,
  };
}

export {
  POLICY_LIBRARY_EVIDENCE_RECORD_AUDIT_RISK_IDS,
  POLICY_LIBRARY_EVIDENCE_RECORD_FIELD_IDS,
  buildPolicyLibraryEvidenceRecordAudit,
  buildPolicyLibraryEvidenceRecordCollectionAudit,
};
