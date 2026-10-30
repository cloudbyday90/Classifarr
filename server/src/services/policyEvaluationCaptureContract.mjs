/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readInventoryRankingIdentity } from './inventoryRankingShadowIdentity.mjs';
import { validFrozenPolicyPurposeEvidence } from './policyPurposeMatchEvidence.mjs';

export const POLICY_EVALUATION_CAPTURE_VERSION = 'policy_evaluation.v2';
export const POLICY_EVALUATION_CAPTURE_BYTES = 65536;
export const POLICY_EVALUATION_CAPTURE_CANDIDATES = 64;
export const POLICY_EVALUATION_GAPS = Object.freeze(['authoritative_bypass', 'no_active_policies',
  'no_compatible_policies', 'pool_overflow', 'payload_overflow', 'capture_invalid', 'binding_failure']);
export const POLICY_EVALUATION_SOURCES = Object.freeze(['native_intent', 'compatibility_bridge', 'unverified']);
export const POLICY_EVALUATION_AUTHORITY_STATUSES = Object.freeze(['native_intent_active', 'native_intent_invalid',
  'native_intent_authority_conflict', 'compatibility_bridge_fallback', 'unverified']);
export const POLICY_EVALUATION_RUNTIME_STATUSES = Object.freeze(['native_intent_runtime_active',
  'native_intent_runtime_no_purpose', 'native_intent_runtime_purpose_not_matched', 'native_intent_runtime_hard_limit_failed',
  'native_intent_runtime_hard_limit_unknown', 'native_intent_runtime_authority_blocked', 'not_applicable', 'unverified']);
const POLICY_EVALUATION_DISPOSITIONS = Object.freeze(['ranked', 'constraint_conflict', 'non_comparable', 'ranking_excluded']);
const provenance = ['declared_native', 'profile_derived', 'mixed', 'unverified'];
const admissions = ['inferred_profile_ranking', 'not_recorded', 'not_applicable', 'unverified'];
const signals = ['preset', 'intent', 'pattern', 'rag', 'history', 'profile'];
const id = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const numeric = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1000000;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const numbers = value => exact(value, signals) && signals.every(key => numeric(value[key]));
const thresholds = value => exact(value, ['autoClassify', 'prompt']) &&
  [value.autoClassify, value.prompt].every(number => number === null || numeric(number));

/** PostgreSQL jsonb text adds separator spaces and expands exponent notation. Admit that representation too. */
export function policyEvaluationPayloadBytes(value) {
  if (Array.isArray(value)) return 2 + Math.max(0, value.length - 1) * 2 + value.reduce((sum, item) => sum + policyEvaluationPayloadBytes(item), 0);
  if (value && typeof value === 'object') return 2 + Math.max(0, Object.keys(value).length - 1) * 2 +
    Object.entries(value).reduce((sum, [key, item]) => sum + Buffer.byteLength(JSON.stringify(key)) + 2 + policyEvaluationPayloadBytes(item), 0);
  const text = JSON.stringify(value);
  if (typeof text !== 'string') return Infinity;
  const [mantissa, exponent] = typeof value === 'number' ? text.split('e') : [text];
  if (exponent === undefined) return Buffer.byteLength(text);
  const digits = mantissa.replace('-', '').replace('.', '').length, power = Number(exponent);
  return Number(mantissa.startsWith('-')) + (power < 0 ? 2 - power - 1 + digits : Math.max(power + 1, digits) + Number(digits > power + 1));
}

/** Closed persisted contract: no names, raw rules, prompts, trace attributes or current configuration. */
export function validPolicyEvaluationCapture(value) {
  if (!exact(value, ['version', 'mediaType', 'identityKey', 'capturedAt', 'stage', 'policyCount',
    'skippedMediaTypeCount', 'candidates', 'ranked', 'exclusions']) || !['policy_evaluation.v1', POLICY_EVALUATION_CAPTURE_VERSION].includes(value.version) ||
    !readInventoryRankingIdentity(value.identityKey, value.mediaType) ||
    typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt)) ||
    new Date(value.capturedAt).toISOString() !== value.capturedAt || value.stage !== 'retained_policy_evaluation' ||
    !Number.isSafeInteger(value.policyCount) || value.policyCount < 1 ||
    !Number.isSafeInteger(value.skippedMediaTypeCount) || value.skippedMediaTypeCount < 0 ||
    !Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > POLICY_EVALUATION_CAPTURE_CANDIDATES ||
    value.policyCount !== value.candidates.length + value.skippedMediaTypeCount || !Array.isArray(value.ranked) ||
    value.ranked.length > value.candidates.length || !exact(value.exclusions, POLICY_EVALUATION_DISPOSITIONS.slice(1))) return false;
  const candidates = new Map();
  for (const row of value.candidates) {
    if (!exact(row, ['policyId', 'libraryId', 'authority', 'purposeProvenance', 'runtime', 'rawScore', 'scores', 'weights', 'thresholds', 'disposition',
      ...(value.version === POLICY_EVALUATION_CAPTURE_VERSION ? ['purposeEvidence'] : [])]) ||
      !id(row.policyId) || !id(row.libraryId) || candidates.has(row.policyId) || !numeric(row.rawScore) ||
      !numbers(row.scores) || !numbers(row.weights) || !thresholds(row.thresholds) ||
      !POLICY_EVALUATION_DISPOSITIONS.includes(row.disposition) || !provenance.includes(row.purposeProvenance) ||
      !exact(row.authority, ['source', 'status', 'validationOk']) || !POLICY_EVALUATION_SOURCES.includes(row.authority.source) ||
      !POLICY_EVALUATION_AUTHORITY_STATUSES.includes(row.authority.status) || typeof row.authority.validationOk !== 'boolean' ||
      (row.purposeProvenance !== 'unverified' && (row.authority.source !== 'native_intent' || !row.authority.validationOk ||
        row.authority.status !== 'native_intent_active')) ||
      !exact(row.runtime, ['status', 'eligible', 'admission']) || !POLICY_EVALUATION_RUNTIME_STATUSES.includes(row.runtime.status) ||
      ![true, false, null].includes(row.runtime.eligible) || !admissions.includes(row.runtime.admission) ||
      (row.runtime.admission === 'inferred_profile_ranking' && (row.authority.source !== 'native_intent' ||
        row.runtime.eligible !== true || row.runtime.status !== 'native_intent_runtime_active')) ||
      (value.version === POLICY_EVALUATION_CAPTURE_VERSION && row.purposeEvidence !== null &&
        (!validFrozenPolicyPurposeEvidence(row.purposeEvidence) || row.purposeEvidence.origin !== row.purposeProvenance ||
          row.purposeEvidence.runtimeEligible !== row.runtime.eligible || row.authority.source !== 'native_intent' ||
          row.authority.status !== 'native_intent_active' || row.authority.validationOk !== true))) return false;
    candidates.set(row.policyId, row);
  }
  const seen = new Set();
  for (const row of value.ranked) {
    const candidate = candidates.get(row?.policyId);
    if (!exact(row, ['policyId', 'libraryId', 'score', 'thresholds']) || !candidate || seen.has(row.policyId) ||
      row.libraryId !== candidate.libraryId || candidate.disposition !== 'ranked' || !numeric(row.score) || !thresholds(row.thresholds)) return false;
    seen.add(row.policyId);
  }
  if (value.candidates.some(row => (row.disposition === 'ranked') !== seen.has(row.policyId))) return false;
  return POLICY_EVALUATION_DISPOSITIONS.slice(1).every(reason =>
    value.exclusions[reason] === value.candidates.filter(row => row.disposition === reason).length) &&
    policyEvaluationPayloadBytes(value) <= POLICY_EVALUATION_CAPTURE_BYTES;
}

export function freezePolicyEvaluationValue(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezePolicyEvaluationValue); Object.freeze(value); }
  return value;
}
