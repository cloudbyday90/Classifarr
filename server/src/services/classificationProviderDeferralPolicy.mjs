/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const deferredErrors = new WeakSet();
export const PROVIDER_DEFERRAL_REASON = 'Waiting for AI provider recovery - Classifarr will retry automatically without using an item retry';

export function hasProviderConfigurationRevision(config) {
  return /^(0|[1-9][0-9]{0,18})$/.test(String(config?.configuration_revision ?? ''));
}

export function buildClassificationDependencyKey(snapshot, provider) {
  if (!hasProviderConfigurationRevision(snapshot?.config) || !provider?.type || !provider.config?.model) return null;
  // API keys are excluded. Endpoint values are hashed, never stored or logged.
  // Credential changes advance the server-owned configuration revision.
  const endpoint = provider.type === 'ollama'
    ? [snapshot.local?.id ?? null, snapshot.local?.host || provider.config.host,
      snapshot.local?.port || provider.config.port]
    : [provider.config.api_endpoint ?? null];
  return createHash('sha256').update(JSON.stringify([
    String(snapshot.config.configuration_revision), provider.type, provider.config.model, endpoint,
  ])).digest('hex');
}

export function createProviderDeferredError() {
  const error = Object.assign(new Error(PROVIDER_DEFERRAL_REASON), { code: 'CLASSIFICATION_PROVIDER_DEFERRED' });
  deferredErrors.add(error);
  return error;
}

export function isProviderDeferredError(error) {
  return error != null && deferredErrors.has(error);
}
