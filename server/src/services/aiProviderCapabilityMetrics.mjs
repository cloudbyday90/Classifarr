/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildAiProviderAuthorityProfile } from './aiProviderAuthority.mjs';

export const AI_PROVIDER_CAPABILITY_METRICS_VERSION = 'ai.provider_capability_metrics.v1';

function hasText(value, pattern) {
  return typeof value === 'string' && pattern.test(value);
}

function getValidationText(parseResult = {}) {
  return [
    parseResult.validation_errors,
    parseResult.policy_question?.meta?.validation_errors,
    parseResult.clarification?.meta?.validation_errors,
  ].filter(value => typeof value === 'string').join(' ');
}

function isStructuredParseSuccess(parseResult = {}) {
  return ['confident', 'confirm', 'CONFIDENT', 'CONFIRM'].includes(parseResult.format)
    && parseResult.needs_clarification !== true;
}

function isTimeoutOrIncomplete(error = null) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  return ['ETIMEDOUT', 'ESTALL', 'EINCOMPLETE', 'ABORT_ERR', 'ERR_CANCELED'].includes(code)
    || message.includes('timed out')
    || message.includes('stalled')
    || message.includes('incomplete stream')
    || message.includes('completion signal');
}

function isOllamaVerificationModelDigestMismatch({ profile, error } = {}) {
  return profile?.providerId === 'ollama'
    && profile?.effectiveMode === 'verification'
    && String(error?.code || '').trim().toUpperCase() === 'MODEL_DIGEST_MISMATCH';
}

/**
 * Builds fixed counters from parser and transport facts. It never stores raw
 * model text, model-selected commands, provider credentials, or item metadata.
 */
export function buildAiProviderCapabilityMetricDelta({
  authority,
  parseResult = null,
  diagnostics = null,
  generationError = null,
  thinkingTraceDetected = false,
} = {}) {
  const profile = authority || buildAiProviderAuthorityProfile();
  const validationText = getValidationText(parseResult || {});
  const violationReason = String(
    parseResult?.policy_question?.meta?.violation_reason
    || parseResult?.clarification?.meta?.violation_reason
    || parseResult?.parse_failure_reason
    || '',
  );
  const semanticContractViolation = parseResult?.format === 'contract_violation';
  const repairAttempted = diagnostics?.repair_attempted === true
    || diagnostics?.repairAttempted === true;
  const repairSucceeded = diagnostics?.repair_succeeded === true
    || diagnostics?.repairSucceeded === true;

  return Object.freeze({
    version: AI_PROVIDER_CAPABILITY_METRICS_VERSION,
    providerId: profile.providerId,
    model: profile.model,
    authorityMode: profile.effectiveMode,
    requestCount: 1,
    structuredParseSuccessCount: isStructuredParseSuccess(parseResult || {}) ? 1 : 0,
    semanticContractViolationCount: semanticContractViolation ? 1 : 0,
    repairAttemptCount: repairAttempted ? 1 : 0,
    repairSuccessCount: repairSucceeded ? 1 : 0,
    timeoutOrIncompleteStreamCount: isTimeoutOrIncomplete(generationError) ? 1 : 0,
    modelDigestMismatchCount: isOllamaVerificationModelDigestMismatch({
      profile,
      error: generationError,
    }) ? 1 : 0,
    hallucinatedLibraryReferenceCount: (
      hasText(violationReason, /option|library/i)
      || hasText(validationText, /library|option/i)
    ) ? 1 : 0,
    hallucinatedActionCount: hasText(
      validationText,
      /\b(action|route|routing|learn|notification|provider|database|write)\b/i,
    ) ? 1 : 0,
    thinkingTraceLeakageCount: thinkingTraceDetected ? 1 : 0,
  });
}
