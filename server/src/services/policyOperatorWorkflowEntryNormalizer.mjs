/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  AUTHORITY_SOURCE_IDS,
  getPolicyAuthoritySource,
} from './policyAuthorityVocabulary.mjs';

const MAX_OPERATOR_WORKFLOW_ENTRY_TEXT_LENGTH = 160;

const POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS = Object.freeze({
  MISSING_LABEL: 'missing_workflow_entry_label',
  INVALID_VALUE: 'invalid_workflow_entry_value',
  UNKNOWN_AUTHORITY_SOURCE: 'unknown_workflow_entry_authority_source',
  RAW_FIELD_PRESENT: 'raw_workflow_entry_field_present',
  RAW_PAYLOAD_FLAGGED: 'workflow_entry_raw_payload_flagged',
});

const PROHIBITED_WORKFLOW_ENTRY_KEYS = Object.freeze([
  'rawPayload',
  'providerPayload',
  'metadata',
  'request',
  'response',
  'diagnostics',
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = MAX_OPERATOR_WORKFLOW_ENTRY_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeDisplayValue(value) {
  if (Number.isFinite(value)) return value;
  return normalizeString(value) || null;
}

function normalizePolicyOperatorWorkflowEntry(entry = {}) {
  const source = asObject(entry);
  const displayValue = normalizeDisplayValue(source.value);
  const label = normalizeString(source.label) ||
    (typeof displayValue === 'string' ? displayValue : '') ||
    normalizeString(source.key);
  if (!label) return null;

  const authoritySourceId = normalizeString(source.authoritySourceId, 80);
  const hasKnownAuthoritySource = authoritySourceId && getPolicyAuthoritySource(authoritySourceId);

  return {
    key: normalizeString(source.key, 160) || label.toLowerCase(),
    label,
    value: displayValue,
    authoritySourceId: hasKnownAuthoritySource ? authoritySourceId : null,
    operatorDeclared: source.operatorDeclared === true,
    observed: authoritySourceId === AUTHORITY_SOURCE_IDS.MEDIA_SERVER_CONTENTS,
    reasonCode: normalizeString(source.reasonCode, 120) || null,
    evidenceCount: Number.isFinite(Number(source.evidenceCount)) && Number(source.evidenceCount) >= 0
      ? Number(source.evidenceCount)
      : null,
    includesRawPayload: false,
  };
}

function normalizePolicyOperatorWorkflowEntries(entries) {
  return Array.isArray(entries)
    ? entries.map(normalizePolicyOperatorWorkflowEntry).filter(Boolean)
    : [];
}

function buildPolicyOperatorWorkflowEntryAudit(entry = {}) {
  const source = asObject(entry);
  const issues = [];

  if (!normalizeString(source.label)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Operator workflow entries require a bounded display label.',
    });
  }

  if (!(typeof source.value === 'string' || Number.isFinite(source.value) || source.value === null)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.INVALID_VALUE,
      message: 'Operator workflow entries must not expose object-valued data.',
    });
  }

  if (source.authoritySourceId && !getPolicyAuthoritySource(source.authoritySourceId)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.UNKNOWN_AUTHORITY_SOURCE,
      message: 'Operator workflow entries must use a known authority source.',
    });
  }

  if (PROHIBITED_WORKFLOW_ENTRY_KEYS.some(key => Object.hasOwn(source, key))) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.RAW_FIELD_PRESENT,
      message: 'Operator workflow entries must not include raw provider or diagnostic fields.',
    });
  }

  if (source.includesRawPayload !== false) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS.RAW_PAYLOAD_FLAGGED,
      message: 'Operator workflow entries must explicitly confirm raw payload exclusion.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_OPERATOR_WORKFLOW_ENTRY_AUDIT_RISK_IDS,
  buildPolicyOperatorWorkflowEntryAudit,
  normalizePolicyOperatorWorkflowEntry,
  normalizePolicyOperatorWorkflowEntries,
};
