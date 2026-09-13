/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';

export function projectRepresentativeQuery({ request, identity, vector, configKey }) {
  validateDescriptionRepresentation(identity);
  const key = inventoryDescriptionIdentity({ media_type: request.mediaType, tmdb_id: Number(request.key?.split(':')[1]) });
  if (key !== request.key || !/^[a-f0-9]{64}$/.test(request.hash) || typeof configKey !== 'string' || configKey.length > 2048) {
    throw new Error('representative_query_invalid');
  }
  return { key, mediaType: request.mediaType, hash: request.hash, configKey,
    identity: { provider: identity.provider, model: identity.model, digest: identity.digest, dimensions: identity.dimensions },
    vector: validateEmbedding(vector, identity.dimensions).map(Math.fround) };
}

export function bindRepresentativeDecision(query, { metadata, contract, result }) {
  const text = projectInventoryDescription({ metadata })?.text;
  if (inventoryDescriptionIdentity(metadata) !== query.key || !text ||
      createHash('sha256').update(text).digest('hex') !== query.hash || contract?.valid !== true ||
      !Array.isArray(contract.candidates) || contract.candidates.length < 2 || contract.candidates.length > 64 ||
      result?.needs_retry || result?.provider_recovery) throw new Error('representative_decision_invalid');
  const libraryIds = contract.candidates.map(candidate => candidate.libraryId);
  if (!libraryIds.includes(result?.library?.id) || new Set(libraryIds).size !== libraryIds.length ||
      contract.candidates.some(candidate => !Number.isSafeInteger(candidate.libraryId) || candidate.libraryId < 1 ||
        candidate.mediaType !== query.mediaType)) throw new Error('representative_decision_scope_invalid');
  return { ...query, libraryIds, destinationId: result.library.id };
}
