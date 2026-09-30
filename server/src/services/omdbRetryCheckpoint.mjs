/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { encodeEnrichmentSource } from './queueEnrichmentSourceGuard.mjs';
import { providerCredentialContext } from './providerCredentialRejection.mjs';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
function sourceDigest(item) {
  const source = encodeEnrichmentSource(item, item?.media_type);
  if (!source || !Object.hasOwn(item, 'tmdb_id') ||
    !(item.tmdb_id === null || Number.isSafeInteger(item.tmdb_id))) return null;
  return createHash('sha256').update(JSON.stringify([source, item.tmdb_id])).digest('hex');
}

export function createOmdbRetryCheckpoint(item, context, now = Date.now()) {
  const checked = providerCredentialContext(context?.source, { id: context?.id, credential_generation: context?.generation });
  const source = sourceDigest(item);
  if (!source || !item.imdb_id || !item.title || checked?.source !== 'omdb' || !Number.isSafeInteger(now)) return null;
  return { version: 1, source, configId: checked.id, generation: checked.generation, observedAt: now };
}

/** Shape/source/age check only. Admission separately fences the credential before charging. */
export function readOmdbRetryCheckpoint(item, value, now = Date.now()) {
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.observedAt) ||
    value.observedAt > now || now - value.observedAt >= MAX_AGE_MS) return null;
  const canonical = createOmdbRetryCheckpoint(item,
    { source: 'omdb', id: value.configId, generation: value.generation }, value.observedAt);
  return canonical && canonical.source === value.source ? canonical : null;
}
