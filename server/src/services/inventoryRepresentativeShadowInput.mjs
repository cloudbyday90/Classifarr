/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { representativeValidationError, validateRepresentativeVector } from './representativeValidation.mjs';

export function projectRepresentativeQuery({ request, identity, vector, configKey } = {}) {
  try { validateDescriptionRepresentation(identity); }
  catch { throw representativeValidationError('query_representation'); }
  if (!request || typeof request.key !== 'string') throw representativeValidationError('query_contract', 'representative_query_invalid');
  let key;
  try { key = inventoryDescriptionIdentity({ media_type: request.mediaType, tmdb_id: Number(request.key.split(':')[1]) }); }
  catch { throw representativeValidationError('query_contract', 'representative_query_invalid'); }
  if (key !== request.key || !/^[a-f0-9]{64}$/.test(request.hash) || typeof configKey !== 'string' || configKey.length > 2048) {
    throw representativeValidationError('query_contract', 'representative_query_invalid');
  }
  return { key, mediaType: request.mediaType, hash: request.hash, configKey,
    identity: { provider: identity.provider, model: identity.model, digest: identity.digest, dimensions: identity.dimensions },
    vector: validateRepresentativeVector(vector, identity.dimensions, 'query').map(Math.fround) };
}

export function bindRepresentativeDecision(query, { metadata, contract, result }) {
  let key, text;
  try { key = inventoryDescriptionIdentity(metadata); }
  catch { throw representativeValidationError('decision_identity', 'representative_decision_invalid'); }
  if (key !== query.key)
    throw representativeValidationError('decision_identity', 'representative_decision_invalid');
  try { text = projectInventoryDescription({ metadata })?.text; }
  catch { throw representativeValidationError('decision_description', 'representative_decision_invalid'); }
  if (!text || createHash('sha256').update(text).digest('hex') !== query.hash)
    throw representativeValidationError('decision_description', 'representative_decision_invalid');
  if (contract?.valid !== true ||
      !Array.isArray(contract.candidates) || contract.candidates.length < 2 || contract.candidates.length > 64 ||
      result?.needs_retry || result?.provider_recovery) throw representativeValidationError('decision_contract', 'representative_decision_invalid');
  const libraryIds = contract.candidates.map(candidate => candidate?.libraryId);
  if (!libraryIds.includes(result?.library?.id) || new Set(libraryIds).size !== libraryIds.length ||
      contract.candidates.some(candidate => !Number.isSafeInteger(candidate?.libraryId) || candidate.libraryId < 1 ||
        candidate.mediaType !== query.mediaType)) throw representativeValidationError('decision_scope', 'representative_decision_scope_invalid');
  return { ...query, libraryIds, destinationId: result.library.id };
}
