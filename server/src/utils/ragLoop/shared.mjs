/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
export const TRACE_VERSION = 1;
export const POLICY_ACTION_PRIORITY = Object.freeze({
  manual: 0,
  prompt_select: 1,
  prompt_confirm: 2,
  auto_classify: 3,
});
export const HIGH_IMPACT_FIELDS = Object.freeze([
  'genres',
  'keywords',
  'belongs_to_collection',
  'production_companies',
  'cast',
]);
export const RAG_LOOP_REASON_CODES = Object.freeze({
  FEATURE_DISABLED: 'feature_disabled',
  GATE_NOT_MET: 'gate_not_met',
  MAX_PASSES_REACHED: 'max_passes_reached',
  POLICY_PROMPT_RISK_CLEAR: 'policy_prompt_risk_clear',
  POLICY_CONTEXT_MISSING: 'policy_context_missing',
  MISSING_TMDB_ID: 'missing_tmdb_id',
  MISSING_MEDIA_TYPE: 'missing_media_type',
  INSUFFICIENT_HIGH_IMPACT_METADATA: 'insufficient_high_impact_metadata',
  NO_VERIFIABLE_EVIDENCE: 'no_verifiable_evidence',
  NON_AUTHORITATIVE_IDENTIFIERS_REJECTED: 'non_authoritative_identifiers_rejected',
  TRIGGER_NOT_POLICY: 'trigger_not_policy',
  RAG_PASS1_CANDIDATE_FAILED: 'rag_pass1_candidate_failed',
  RAG_PASS1_CANDIDATE_TIMEOUT: 'rag_pass1_candidate_timeout',
  RAG_PASS1_CANDIDATE_PROVIDER_FAILED: 'rag_pass1_candidate_provider_failed',
  RAG_PASS1_CANDIDATE_DB_FAILED: 'rag_pass1_candidate_db_failed',
  RAG_PASS1_CANDIDATE_EMBED_FAILED: 'rag_pass1_candidate_embed_failed',
  RAG_PASS1_CANDIDATE_ABORTED: 'rag_pass1_candidate_aborted',
  RAG_PASS2_FAILED: 'rag_pass2_failed',
  RAG_PASS2_TIMEOUT: 'rag_pass2_timeout',
  RAG_PASS2_PROVIDER_FAILED: 'rag_pass2_provider_failed',
  RAG_PASS2_DB_FAILED: 'rag_pass2_db_failed',
  RAG_PASS2_EMBED_FAILED: 'rag_pass2_embed_failed',
  RAG_PASS2_ABORTED: 'rag_pass2_aborted',
  DB_INTEGRITY_VIOLATION: 'db_integrity_violation',
  DB_RETRYABLE_CONFLICT: 'db_retryable_conflict',
  DB_SCHEMA_MISMATCH: 'db_schema_mismatch',
  DB_UNKNOWN_FAILURE: 'db_unknown_failure',
});
export const RAG_LOOP_FALLBACK_ACTIONS = Object.freeze({
  BASELINE_PRESERVED: 'baseline_preserved',
  GATE_SKIPPED: 'gate_skipped',
  ENRICHMENT_SKIPPED: 'enrichment_skipped',
  PASS2_SKIPPED: 'pass2_skipped',
  POLICY_RECHECK_SKIPPED: 'policy_recheck_skipped',
  AI_RERUN_SKIPPED: 'ai_rerun_skipped',
  TRACE_OMITTED: 'trace_omitted',
});
const TRACE_ALLOWED_MODES = new Set(['shadow', 'apply']);
const TRACE_ALLOWED_STAGES = new Set([
  'gate',
  'enrichment',
  'retrieval_pass2',
  'policy_recheck',
  'ai_rerun',
  'rag_candidate',
  'trace',
]);
const TRACE_ALLOWED_TRIGGERS = new Set([
  'policy_prompt_select',
  'policy_prompt_confirm',
  'ai_low_confidence',
  'legacy_low_signal',
]);
const TRACE_SENSITIVE_PATTERN = /api[_-]?key|token|authorization|password|secret|bearer/i;
export const LANGUAGE_QUERY_KEYWORDS = Object.freeze({
  es: 'spanish', fr: 'french', de: 'german', it: 'italian', pt: 'portuguese',
  ru: 'russian', ar: 'arabic', zh: 'chinese', ja: 'japanese', ko: 'korean',
  hi: 'hindi', ta: 'tamil', te: 'telugu', kn: 'kannada', ml: 'malayalam',
  mr: 'marathi', bn: 'bengali', pa: 'punjabi', ur: 'urdu', th: 'thai',
  vi: 'vietnamese', id: 'indonesian', ms: 'malay', nl: 'dutch', pl: 'polish',
  sv: 'swedish', da: 'danish', nb: 'norwegian', fi: 'finnish', cs: 'czech',
  hu: 'hungarian', ro: 'romanian', el: 'greek', tr: 'turkish', uk: 'ukrainian',
  bg: 'bulgarian', hr: 'croatian', sk: 'slovak', ca: 'catalan', he: 'hebrew',
  fa: 'farsi',
});
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
export function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
export function getStringValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object') {
    if (typeof value.name === 'string') {
      return value.name.trim();
    }
    if (typeof value.title === 'string') {
      return value.title.trim();
    }
  }
  return '';
}
export function normalizeToken(value) {
  const text = getStringValue(value).toLowerCase();
  return text.replace(/\s+/g, ' ').trim();
}
export function normalizeTokenArray(values = [], maxItems = 10, minTokenLength = 1) {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }
  const normalized = [];
  const seen = new Set();
  for (const value of values) {
    const token = normalizeToken(value);
    if (!token || token.length < minTokenLength || seen.has(token)) {
      continue;
    }
    seen.add(token);
    normalized.push(token);
    if (normalized.length >= maxItems) {
      break;
    }
  }
  return normalized;
}
export function normalizeTraceToken(value, fallback = null, maxLength = 64) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLength);
  return normalized || fallback;
}
export function sanitizeTraceMode(mode) {
  const normalized = normalizeTraceToken(mode, 'shadow', 16);
  return TRACE_ALLOWED_MODES.has(normalized) ? normalized : 'shadow';
}
export function sanitizeTraceTrigger(trigger) {
  const normalized = normalizeTraceToken(trigger, null, 48);
  if (!normalized) {
    return null;
  }
  return TRACE_ALLOWED_TRIGGERS.has(normalized) ? normalized : null;
}
export function sanitizeTraceStage(stage) {
  const normalized = normalizeTraceToken(stage, 'trace', 48);
  return TRACE_ALLOWED_STAGES.has(normalized) ? normalized : 'trace';
}
export function sanitizeTraceReason(value, fallback = null) {
  if (typeof value !== 'string') {
    return fallback;
  }
  if (TRACE_SENSITIVE_PATTERN.test(value)) {
    return 'redacted';
  }
  return normalizeTraceToken(value, fallback, 80);
}
export function sanitizeTraceEvent(event = {}, normalizeSqlState) {
  const stage = sanitizeTraceStage(event.stage || 'trace');
  const reasonCode = sanitizeTraceReason(event.reason_code || event.reason, null);
  const fallbackAction = sanitizeTraceReason(event.fallback_action, null);
  return {
    stage,
    outcome: normalizeTraceToken(event.outcome || 'unknown', 'unknown', 48),
    reason: reasonCode,
    reason_code: reasonCode,
    fallback_action: fallbackAction,
    recoverable: event.recoverable === false ? false : true,
    sql_state: normalizeSqlState({ code: event.sql_state || event.sqlState }),
  };
}
const sharedHelpers = {
  TRACE_VERSION,
  POLICY_ACTION_PRIORITY,
  HIGH_IMPACT_FIELDS,
  RAG_LOOP_REASON_CODES,
  RAG_LOOP_FALLBACK_ACTIONS,
  LANGUAGE_QUERY_KEYWORDS,
  clamp,
  getStringValue,
  normalizeToken,
  normalizeTokenArray,
  normalizeTraceToken,
  sanitizeTraceEvent,
  sanitizeTraceMode,
  sanitizeTraceReason,
  sanitizeTraceStage,
  sanitizeTraceTrigger,
  toNumber,
};
export default sharedHelpers;
