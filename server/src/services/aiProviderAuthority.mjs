/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { isOpenAIReasoningModel } from './cloudLLMRequestBuilder.mjs';

export const AI_PROVIDER_AUTHORITY_CONTRACT_VERSION = 'ai.provider_authority.v1';

export const AI_PROVIDER_AUTHORITY_MODE_IDS = Object.freeze({
  STRUCTURED_CONTRACT: 'structured_contract',
  VERIFICATION: 'verification',
  PROPOSAL: 'proposal',
  EXPLANATION: 'explanation',
  FALLBACK_ADVISORY: 'fallback_advisory',
  DISABLED: 'disabled',
});

const ACTIVE_AUTHORITY_MODE_IDS = Object.freeze([
  AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT,
  AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
  AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL,
  AI_PROVIDER_AUTHORITY_MODE_IDS.EXPLANATION,
  AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY,
]);

const REQUESTABLE_AUTHORITY_MODE_IDS = Object.freeze([
  ...ACTIVE_AUTHORITY_MODE_IDS,
  AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED,
]);

const PROVIDER_IDS_WITH_SERVER_ENFORCED_SCHEMA = new Set(['openai', 'gemini']);
const DISABLED_PROVIDER_IDS = new Set(['', 'none', 'disabled']);

function normalizeProviderId(value) {
  const providerId = String(value || '').trim().toLowerCase();
  return providerId.replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'none';
}

function normalizeModelId(value) {
  const modelId = String(value || '').trim();
  return modelId.slice(0, 255) || 'unknown';
}

function normalizeRequestedMode(value, { isFallback = false } = {}) {
  if (REQUESTABLE_AUTHORITY_MODE_IDS.includes(value)) {
    return value;
  }

  return isFallback
    ? AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY
    : AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL;
}

function supportsServerEnforcedStructuredOutput({ providerId, modelId }) {
  if (!PROVIDER_IDS_WITH_SERVER_ENFORCED_SCHEMA.has(providerId)) {
    return false;
  }

  if (providerId !== 'openai') {
    return true;
  }

  return !isOpenAIReasoningModel({
    primary_provider: providerId,
    model: modelId,
  });
}

function resolveSupportedModeIds({ providerId, modelId }) {
  if (DISABLED_PROVIDER_IDS.has(providerId)) {
    return [AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED];
  }

  const supportedModeIds = [
    AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL,
    AI_PROVIDER_AUTHORITY_MODE_IDS.EXPLANATION,
    AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY,
    AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED,
  ];

  if (supportsServerEnforcedStructuredOutput({ providerId, modelId })) {
    supportedModeIds.unshift(
      AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT,
      AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    );
  }

  return supportedModeIds;
}

function resolveEffectiveMode({ requestedMode, supportedModeIds, isFallback }) {
  if (supportedModeIds.length === 1) {
    return AI_PROVIDER_AUTHORITY_MODE_IDS.DISABLED;
  }

  if (isFallback) {
    return AI_PROVIDER_AUTHORITY_MODE_IDS.FALLBACK_ADVISORY;
  }

  if (supportedModeIds.includes(requestedMode)) {
    return requestedMode;
  }

  return AI_PROVIDER_AUTHORITY_MODE_IDS.PROPOSAL;
}

/**
 * Derives a conservative, server-owned authority profile. Provider location is
 * not a trust signal: unsupported and local models never receive contract or
 * verification authority merely because they can emit JSON.
 */
export function buildAiProviderAuthorityProfile({
  providerId: providerIdInput,
  model: modelInput,
  requestedMode,
  isFallback = false,
} = {}) {
  const providerId = normalizeProviderId(providerIdInput);
  const model = normalizeModelId(modelInput);
  const supportedModeIds = resolveSupportedModeIds({ providerId, modelId: model });
  const normalizedRequestedMode = normalizeRequestedMode(requestedMode, { isFallback });
  const effectiveMode = resolveEffectiveMode({
    requestedMode: normalizedRequestedMode,
    supportedModeIds,
    isFallback,
  });
  const supportsStructuredOutput = supportsServerEnforcedStructuredOutput({
    providerId,
    modelId: model,
  });

  return Object.freeze({
    version: AI_PROVIDER_AUTHORITY_CONTRACT_VERSION,
    providerId,
    model,
    requestedMode: normalizedRequestedMode,
    effectiveMode,
    downgraded: normalizedRequestedMode !== effectiveMode,
    isFallback: Boolean(isFallback),
    supportedModeIds: Object.freeze([...supportedModeIds]),
    capabilities: Object.freeze({
      providerEnforcedStructuredOutput: supportsStructuredOutput,
      semanticNormalizationRequired: true,
      contractGrade: effectiveMode === AI_PROVIDER_AUTHORITY_MODE_IDS.STRUCTURED_CONTRACT
        || effectiveMode === AI_PROVIDER_AUTHORITY_MODE_IDS.VERIFICATION,
    }),
    sideEffects: Object.freeze({
      canRoute: false,
      canLearn: false,
      canMutatePolicy: false,
      canNotify: false,
      canCallProviders: false,
      canWriteDomainData: false,
    }),
  });
}

export function isAiProviderAuthorityModeAvailable(profile, mode) {
  return Boolean(profile?.supportedModeIds?.includes(mode));
}

export function isAiProviderAuthorityModeGranted(profile, mode) {
  return profile?.effectiveMode === mode;
}

/**
 * Returns the safe authority projection allowed to cross a model-output
 * boundary. No credentials, prompts, raw output, or executable actions exist
 * in this object.
 */
export function buildAiProviderAuthorityView(profile) {
  const authority = profile || buildAiProviderAuthorityProfile();

  return Object.freeze({
    version: authority.version,
    providerId: authority.providerId,
    model: authority.model,
    requestedMode: authority.requestedMode,
    effectiveMode: authority.effectiveMode,
    downgraded: authority.downgraded,
    isFallback: authority.isFallback,
    supportedModeIds: Object.freeze([...authority.supportedModeIds]),
    capabilities: authority.capabilities,
    sideEffects: authority.sideEffects,
  });
}
