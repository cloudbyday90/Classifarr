/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { providerCredentialContext } from './providerCredentialRejection.mjs';

// Internal provenance cannot be supplied through error bodies or serialized API objects.
const evidence = new WeakMap();
export function rememberProviderRequest(target, contexts) {
  if (!target || typeof target !== 'object' || !Array.isArray(contexts) || !contexts.length || contexts.length > 4) return target;
  const checked = contexts.map(context => {
    const credential = providerCredentialContext(context?.source, { id: context?.id, credential_generation: context?.generation });
    const providerKey = context?.providerKey;
    if (!credential || !['omdb', 'tavily', 'brave', 'serper'].includes(providerKey) ||
      (credential.source === 'omdb') !== (providerKey === 'omdb') ||
      (credential.source === 'legacy_tavily' && providerKey !== 'tavily')) return null;
    return Object.freeze({ ...credential, generation: credential.generation.toLowerCase(), providerKey });
  });
  if (checked.every(Boolean)) evidence.set(target, Object.freeze(checked));
  return target;
}
export function providerRequestEvidence(target) { return evidence.get(target) ?? null; }

/** All attempts must be known; partial provenance must never authorize early retry. */
export function inheritProviderRequests(target, attempts) {
  const contexts = attempts.map(providerRequestEvidence);
  return contexts.length && contexts.every(Boolean) ? rememberProviderRequest(target, contexts.flat()) : target;
}
