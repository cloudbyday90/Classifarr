/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const MAX_POLICY_EVIDENCE_ENTRY_KEY_LENGTH = 160;
const MAX_POLICY_EVIDENCE_ENTRY_LABEL_LENGTH = 240;
const MAX_POLICY_EVIDENCE_ENTRY_VALUE_LENGTH = 240;
const MAX_POLICY_EVIDENCE_ENTRY_REASON_CODE_LENGTH = 120;

const POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS = Object.freeze({
  MISSING_LABEL: 'missing_evidence_entry_label',
  INVALID_KEY: 'invalid_evidence_entry_key',
  INVALID_VALUE: 'invalid_evidence_entry_value',
  INVALID_REASON_CODE: 'invalid_evidence_entry_reason_code',
  INVALID_OBSERVED_AT: 'invalid_evidence_entry_observed_at',
  UNBOUNDED_TEXT: 'unbounded_evidence_entry_text',
  UNSAFE_CONTROL_CHARACTER: 'unsafe_evidence_entry_control_character',
});

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u;
const CONTROL_CHARACTER_REPLACEMENT_PATTERN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/gu;
const EVIDENCE_KEY_UNSAFE_CHARACTER_PATTERN = /[^\p{L}\p{N}:._-]+/gu;
const EVIDENCE_KEY_SEPARATOR_PATTERN = /[-_.]{2,}/gu;
const EVIDENCE_REASON_CODE_PATTERN = /^[a-z][a-z0-9_]*$/u;

function normalizeText(value, maximumLength) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFC')
    .replace(CONTROL_CHARACTER_REPLACEMENT_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeEvidenceKey(value, fallbackLabel = '') {
  const source = normalizeText(value, MAX_POLICY_EVIDENCE_ENTRY_KEY_LENGTH) ||
    normalizeText(fallbackLabel, MAX_POLICY_EVIDENCE_ENTRY_KEY_LENGTH);
  if (!source) return null;

  const key = source
    .toLowerCase()
    .replace(/\s+/gu, '_')
    .replace(EVIDENCE_KEY_UNSAFE_CHARACTER_PATTERN, '-')
    .replace(/:_+/gu, ':')
    .replace(EVIDENCE_KEY_SEPARATOR_PATTERN, '-')
    .replace(/^[-_.:]+|[-_.:]+$/gu, '')
    .slice(0, MAX_POLICY_EVIDENCE_ENTRY_KEY_LENGTH);

  return key || null;
}

function normalizeReasonCode(value) {
  const reasonCode = normalizeText(value, MAX_POLICY_EVIDENCE_ENTRY_REASON_CODE_LENGTH)
    .toLowerCase();

  return EVIDENCE_REASON_CODE_PATTERN.test(reasonCode) ? reasonCode : null;
}

function normalizeObservedAt(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeCount(value) {
  if (value === null || value === undefined || value === '') return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : null;
}

function normalizeConfidence(value) {
  if (value === null || value === undefined || value === '') return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  return numeric > 1
    ? Math.max(0, Math.min(1, numeric / 100))
    : Math.max(0, Math.min(1, numeric));
}

function normalizePolicyEvidenceEntry({
  key,
  label,
  value = null,
  count = null,
  confidence = null,
  reasonCode = null,
  observedAt = null,
  stale = null,
} = {}, {
  defaultReasonCode = null,
  allowedReasonCodes = [],
} = {}) {
  const normalizedLabel = normalizeText(label ?? key ?? value, MAX_POLICY_EVIDENCE_ENTRY_LABEL_LENGTH);
  if (!normalizedLabel) return null;

  const normalizedDefaultReasonCode = normalizeReasonCode(defaultReasonCode);
  const normalizedInputReasonCode = normalizeReasonCode(reasonCode);
  const normalizedAllowedReasonCodes = Array.isArray(allowedReasonCodes)
    ? allowedReasonCodes.map(normalizeReasonCode).filter(Boolean)
    : [];
  const selectedReasonCode = normalizedAllowedReasonCodes.includes(normalizedInputReasonCode)
    ? normalizedInputReasonCode
    : normalizedDefaultReasonCode;

  return {
    key: normalizeEvidenceKey(key, normalizedLabel),
    label: normalizedLabel,
    value: normalizeText(value, MAX_POLICY_EVIDENCE_ENTRY_VALUE_LENGTH) || null,
    count: normalizeCount(count),
    confidence: normalizeConfidence(confidence),
    // Reason codes are controlled by the source adapter, not incoming evidence.
    reasonCode: selectedReasonCode,
    observedAt: normalizeObservedAt(observedAt),
    stale: typeof stale === 'boolean' ? stale : null,
  };
}

function buildPolicyEvidenceEntryAudit(entry = {}) {
  const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
  const issues = [];
  const label = normalizeText(source.label, MAX_POLICY_EVIDENCE_ENTRY_LABEL_LENGTH);
  const key = normalizeEvidenceKey(source.key, source.label);
  const value = source.value === null ? null : normalizeText(source.value, MAX_POLICY_EVIDENCE_ENTRY_VALUE_LENGTH) || null;
  const reasonCode = source.reasonCode === null ? null : normalizeReasonCode(source.reasonCode);
  const observedAt = source.observedAt === null ? null : normalizeObservedAt(source.observedAt);
  const textValues = [source.key, source.label, source.value, source.reasonCode, source.observedAt]
    .filter(value => typeof value === 'string');

  if (!label) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.MISSING_LABEL,
      message: 'Evidence entries require a bounded display label.',
    });
  }

  if (!key || source.key !== key) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_KEY,
      message: 'Evidence entry keys must use a canonical bounded identifier.',
    });
  }

  if (!(typeof source.value === 'string' || source.value === null) || source.value !== value) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_VALUE,
      message: 'Evidence entry values must be bounded text or null.',
    });
  }

  if (source.reasonCode !== null && source.reasonCode !== reasonCode) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_REASON_CODE,
      message: 'Evidence entry reason codes must use a bounded canonical identifier.',
    });
  }

  if (source.observedAt !== null && source.observedAt !== observedAt) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.INVALID_OBSERVED_AT,
      message: 'Evidence entry timestamps must use canonical ISO-8601 UTC format.',
    });
  }

  if (textValues.some(value => value.length > MAX_POLICY_EVIDENCE_ENTRY_LABEL_LENGTH)) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.UNBOUNDED_TEXT,
      message: 'Evidence entry text fields must remain within their bounded contract lengths.',
    });
  }

  if (textValues.some(value => CONTROL_CHARACTER_PATTERN.test(value))) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS.UNSAFE_CONTROL_CHARACTER,
      message: 'Evidence entry text fields must not include control characters.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

export {
  MAX_POLICY_EVIDENCE_ENTRY_KEY_LENGTH,
  MAX_POLICY_EVIDENCE_ENTRY_LABEL_LENGTH,
  MAX_POLICY_EVIDENCE_ENTRY_REASON_CODE_LENGTH,
  MAX_POLICY_EVIDENCE_ENTRY_VALUE_LENGTH,
  POLICY_EVIDENCE_ENTRY_AUDIT_RISK_IDS,
  buildPolicyEvidenceEntryAudit,
  normalizePolicyEvidenceEntry,
};
