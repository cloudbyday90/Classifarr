/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  buildAiProviderAuthorityProfile,
  buildAiProviderAuthorityView,
} from './aiProviderAuthority.mjs';

export const CLASSIFICATION_AI_REPAIR_PROVIDER_ID = 'ollama';
export const CLASSIFICATION_AI_REPAIR_PROVENANCE_VERSION = 'classification.ai_repair_provenance.v1';

function buildRepairProviderAuthority({ sourceAuthority, repairModel } = {}) {
  return buildAiProviderAuthorityProfile({
    providerId: CLASSIFICATION_AI_REPAIR_PROVIDER_ID,
    model: repairModel,
    requestedMode: sourceAuthority?.requestedMode,
  });
}

/**
 * Resolves the authority for an accepted repair response. Repair currently
 * executes through the local Ollama adapter, so a cross-provider repair must
 * never retain a cloud provider's stronger authority profile.
 */
export function resolveClassificationAiRepairAuthority({
  sourceAuthority,
  repairModel,
} = {}) {
  const repairProviderAuthority = buildRepairProviderAuthority({
    sourceAuthority,
    repairModel,
  });
  const usesSameProviderAndModel = sourceAuthority?.providerId === repairProviderAuthority.providerId
    && sourceAuthority?.model === repairProviderAuthority.model;

  if (usesSameProviderAndModel) {
    return sourceAuthority;
  }

  return buildAiProviderAuthorityProfile({
    providerId: repairProviderAuthority.providerId,
    model: repairProviderAuthority.model,
    requestedMode: sourceAuthority?.requestedMode,
    isFallback: true,
  });
}

function toSafeAuthorityProvenance(authority) {
  const view = buildAiProviderAuthorityView(authority);

  return Object.freeze({
    provider_id: view.providerId,
    model: view.model,
    effective_mode: view.effectiveMode,
    is_fallback: view.isFallback,
  });
}

/**
 * Builds the bounded provenance retained for a repair attempt. It contains
 * only server-derived provider identity and authority facts, never prompts,
 * model output, item metadata, or credentials.
 */
export function buildClassificationAiRepairProvenance({
  sourceAuthority,
  repairAuthority,
} = {}) {
  const source = toSafeAuthorityProvenance(sourceAuthority);
  const repair = toSafeAuthorityProvenance(repairAuthority);

  return Object.freeze({
    version: CLASSIFICATION_AI_REPAIR_PROVENANCE_VERSION,
    source,
    repair,
    cross_provider: source.provider_id !== repair.provider_id,
    cross_model: source.model !== repair.model,
  });
}
