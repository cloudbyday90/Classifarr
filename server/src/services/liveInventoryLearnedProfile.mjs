/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION } from './inventoryDescriptionProjection.mjs';
import { inventoryDescriptionQueryExcludedHashes } from './inventoryDescriptionQueryExclusions.mjs';
import { collectInventoryCandidateMetadata } from './inventoryMetadataCandidates.mjs';
import { INVENTORY_LEARNED_PROFILE_VERSION, learnInventoryProfiles, scoreInventoryProfile } from './inventoryLearnedProfiles.mjs';
import { estimateInventoryProfileWeight } from './liveInventoryModelCache.mjs';

/** Normalize live metadata through the same bounded projection as training. */
export function projectLiveInventoryQueryMetadata(metadata) {
  const genres = Array.isArray(metadata.genres) ? metadata.genres.slice(0, 32)
    .map(genre => typeof genre === 'string' ? genre : genre?.name) : [];
  return collectInventoryCandidateMetadata([{ ...metadata, genres }]).values().next().value;
}

/** Reuse fitting only after hashing this fresh snapshot's exact held-out training inputs. */
export function buildLiveInventoryLearnedProfiles({ rows, corpus, request, modelCache }) {
  const documents = corpus.documents.filter(doc => doc.type === request.mediaType);
  const metadata = collectInventoryCandidateMetadata(rows.filter(row => row.media_type === request.mediaType));
  const libraryIds = new Set(request.libraryIds);
  const held = inventoryDescriptionQueryExcludedHashes(rows, request);
  for (const doc of documents) {
    for (const id of doc.libraryIds) libraryIds.add(id);
  }
  const libraries = [...libraryIds].sort((a, b) => a - b).map(id => ({ id, media_type: request.mediaType }));
  const training = documents.filter(doc => doc.key !== request.key && !held.has(doc.hash));
  const digest = createHash('sha256').update(JSON.stringify([
    INVENTORY_LEARNED_PROFILE_VERSION, INVENTORY_DESCRIPTION_PROJECTION_VERSION,
    request.key, request.hash, request.queryMetadata, libraries, [...held].sort(),
  ]));
  const fitDigest = createHash('sha256').update(JSON.stringify([
    INVENTORY_LEARNED_PROFILE_VERSION, INVENTORY_DESCRIPTION_PROJECTION_VERSION, libraries,
  ]));
  for (const doc of [...training].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)) {
    const value = JSON.stringify([doc.key, doc.hash, [...doc.libraryIds].sort((a, b) => a - b), metadata.get(doc.key)]);
    digest.update(value); fitDigest.update(value);
  }
  const snapshotId = digest.digest('hex');
  const fitKey = fitDigest.digest('hex');
  let model = modelCache?.get(fitKey);
  if (!model) {
    model = learnInventoryProfiles(training, metadata, libraries);
    if (model.summary.trainingDescriptions > 0) modelCache?.set(fitKey, model, estimateInventoryProfileWeight(model));
  }
  return new Map(request.libraryIds.map(libraryId => {
    const relativeFit = Number(scoreInventoryProfile(model, libraryId, request.queryMetadata).toFixed(4));
    return [libraryId, { version: INVENTORY_LEARNED_PROFILE_VERSION, snapshotId,
      statusId: relativeFit === 0 ? 'neutral' : 'available', relativeFit,
      trainingDescriptions: model.summary.trainingDescriptions }];
  }));
}
