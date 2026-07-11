const MAX_POLICY_INTENT_ENTRY_KEY_LENGTH = 160;
const MAX_POLICY_INTENT_ENTRY_TEXT_LENGTH = 240;
const MAX_POLICY_INTENT_REASON_CODE_LENGTH = 120;

const POLICY_INTENT_ENTRY_AUDIT_RISK_IDS = Object.freeze({
  MISSING_LABEL: 'missing_intent_entry_label',
  INVALID_KEY: 'invalid_intent_entry_key',
  INVALID_VALUE: 'invalid_intent_entry_value',
  INVALID_REASON_CODE: 'invalid_intent_entry_reason_code',
  UNSAFE_TEXT: 'unsafe_intent_entry_text',
});

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u;
const CONTROL_CHARACTER_REPLACEMENT_PATTERN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/gu;
const KEY_UNSAFE_CHARACTER_PATTERN = /[^\p{L}\p{N}:._-]+/gu;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9_]*$/u;

function normalizeText(value, maximumLength = MAX_POLICY_INTENT_ENTRY_TEXT_LENGTH) {
  if (typeof value !== 'string') return '';

  return value
    .normalize('NFC')
    .replace(CONTROL_CHARACTER_REPLACEMENT_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeKey(value, fallbackLabel = '') {
  const source = normalizeText(value, MAX_POLICY_INTENT_ENTRY_KEY_LENGTH) ||
    normalizeText(fallbackLabel, MAX_POLICY_INTENT_ENTRY_KEY_LENGTH);
  if (!source) return null;

  const key = source
    .toLowerCase()
    .replace(/\s+/gu, '_')
    .replace(KEY_UNSAFE_CHARACTER_PATTERN, '-')
    .replace(/:_+/gu, ':')
    .replace(/[-_.]{2,}/gu, '-')
    .replace(/^[-_.:]+|[-_.:]+$/gu, '')
    .slice(0, MAX_POLICY_INTENT_ENTRY_KEY_LENGTH);

  return key || null;
}

function normalizeReasonCode(value) {
  const reasonCode = normalizeText(value, MAX_POLICY_INTENT_REASON_CODE_LENGTH).toLowerCase();
  return REASON_CODE_PATTERN.test(reasonCode) ? reasonCode : null;
}

function normalizePolicyIntentEntry({ key, label, value = null, reasonCode = null } = {}) {
  const normalizedLabel = normalizeText(label ?? value ?? key);
  if (!normalizedLabel) return null;

  return {
    key: normalizeKey(key, normalizedLabel),
    label: normalizedLabel,
    value: normalizeText(value) || null,
    reasonCode: normalizeReasonCode(reasonCode),
  };
}

function buildPolicyIntentEntryAudit(entry = {}) {
  const source = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
  const normalized = normalizePolicyIntentEntry(source);
  const issues = [];
  const texts = [source.key, source.label, source.value, source.reasonCode]
    .filter(value => typeof value === 'string');

  if (!normalized?.label) issues.push({ riskId: POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.MISSING_LABEL });
  if (!normalized?.key || source.key !== normalized.key) issues.push({ riskId: POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.INVALID_KEY });
  if (!(typeof source.value === 'string' || source.value === null) || source.value !== normalized?.value) {
    issues.push({ riskId: POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.INVALID_VALUE });
  }
  if (!normalized?.reasonCode || source.reasonCode !== normalized.reasonCode) {
    issues.push({ riskId: POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.INVALID_REASON_CODE });
  }
  if (texts.some(value => value.length > MAX_POLICY_INTENT_ENTRY_TEXT_LENGTH || CONTROL_CHARACTER_PATTERN.test(value))) {
    issues.push({ riskId: POLICY_INTENT_ENTRY_AUDIT_RISK_IDS.UNSAFE_TEXT });
  }

  return { ok: issues.length === 0, issueCount: issues.length, issues };
}

export {
  POLICY_INTENT_ENTRY_AUDIT_RISK_IDS,
  buildPolicyIntentEntryAudit,
  normalizePolicyIntentEntry,
};
