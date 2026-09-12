/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import * as db from '../config/database.mjs';
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { projectInventoryDescription } from './inventoryDescriptionProjection.mjs';
import { createLocalStudyEmbeddingClient, resolveLocalStudyEmbeddingConfig } from './localStudyEmbeddingClient.mjs';
import { inspectDescriptionRepresentation, verifyDescriptionRepresentation } from './inventoryDescriptionBatchWriter.mjs';
import { createLiveInventoryDescriptionRepository } from './liveInventoryDescriptionRepository.mjs';
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { projectLiveInventoryQueryMetadata } from './liveInventoryLearnedProfile.mjs';

function buildRequest(contract, metadata, maxCandidates) {
  const key = inventoryDescriptionIdentity(metadata);
  const projection = projectInventoryDescription({ metadata });
  if (!projection || contract?.valid !== true || !Array.isArray(contract.candidates) ||
      contract.candidates.length < 2 || contract.candidates.length > maxCandidates) return null;
  const libraryIds = contract.candidates.map(candidate => candidate.libraryId);
  if (new Set(libraryIds).size !== libraryIds.length || contract.candidates.some(candidate =>
    !Number.isInteger(candidate.libraryId) || candidate.libraryId < 1 || candidate.libraryId > 2_147_483_647 ||
    candidate.mediaType !== metadata.media_type)) return null;
  return { key, mediaType: metadata.media_type, libraryIds, text: projection.text,
    queryMetadata: projectLiveInventoryQueryMetadata(metadata),
    hash: createHash('sha256').update(projection.text).digest('hex') };
}

/** Read-only live consumer: never fills the cache, expands candidates or routes. */
export function createLiveInventoryDescriptionRetriever({
  repository = createLiveInventoryDescriptionRepository({ withTransaction: callback => db.withTransaction(callback) }),
  createEmbedder = createLocalStudyEmbeddingClient,
  timeoutMs = 15_000,
  maxCandidates = 3,
} = {}) {
  if (!Number.isInteger(maxCandidates) || maxCandidates < 2 || maxCandidates > 64) throw new RangeError('invalid_candidate_limit');
  return {
    async retrieve({ contract, metadata, signal: parentSignal } = {}) {
      let request;
      try { request = buildRequest(contract, metadata, maxCandidates); } catch { request = null; }
      if (!request) return { statusId: 'not_applicable', candidates: [] };
      const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(parentSignal ? [parentSignal] : [])]);
      try {
        signal.throwIfAborted();
        const config = await repository.readConfig();
        const resolved = resolveLocalStudyEmbeddingConfig(config);
        const embedder = createEmbedder(config);
        const identity = await inspectDescriptionRepresentation(embedder, signal);
        let vector = await repository.readQueryVector(identity, request.hash);
        if (!vector) {
          const batch = await embedder.embedBatch([request.text], { dimensions: identity.dimensions, signal });
          if (!Array.isArray(batch) || batch.length !== 1) throw new Error('live_inventory_description_batch_invalid');
          vector = validateEmbedding(batch[0], identity.dimensions).map(Math.fround);
        }
        await verifyDescriptionRepresentation(embedder, identity, signal);
        const candidates = await repository.retrieve({ request, identity, vector, signal });
        const current = resolveLocalStudyEmbeddingConfig(await repository.readConfig());
        if (JSON.stringify(resolved) !== JSON.stringify(current)) throw new Error('live_inventory_description_config_changed');
        signal.throwIfAborted();
        const complete = candidates.every(candidate => candidate.indexed === candidate.eligible);
        const any = candidates.some(candidate => candidate.items.length > 0);
        return { statusId: any ? (complete ? 'available' : 'partial') : 'unavailable', candidates };
      } catch {
        // Provider/database errors can contain private text or endpoint details.
        return { statusId: 'unavailable', candidates: [] };
      }
    },
  };
}

export const liveInventoryDescriptionRetriever = createLiveInventoryDescriptionRetriever();
