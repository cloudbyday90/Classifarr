/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { assertRepresentativeMetadataBudget } from './inventoryRepresentativeCoverage.mjs';
import { createInventoryNeighborhoodIndex } from './inventoryNeighborhoodProfiles.mjs';

export const MULTI_SCALE_VERSION = 'inventory_multi_scale_context_v1';

/** Canonical content-only metadata; no vector ownership or completeness claim. */
export function prepareMultiScaleSourceMetadata(snapshot, representation, held) {
  const dimensions = representation?.dimensions;
  assertRepresentativeMetadataBudget(snapshot, dimensions);
  if (typeof representation.model !== 'string' || !representation.model.length || representation.model.length > 200 ||
      typeof representation.digest !== 'string' || !/^[a-f0-9]{64}$/.test(representation.digest) || held.size > 300 ||
      [...held].some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('multi_scale_source_invalid');
  const scope = new Map(snapshot.libraries.map(row => [row.id, row.media_type]));
  if (snapshot.corpus.documents.some(doc => !doc.libraryIds.length || doc.libraryIds.some(id => scope.get(id) !== doc.type))) {
    throw new Error('multi_scale_unscoped_source');
  }
  const libraries = snapshot.libraries.map(({ id, media_type }) => ({ id, media_type })).sort((a, b) => a.id - b.id);
  const documents = snapshot.corpus.documents.filter(doc => !held.has(doc.hash));
  const index = createInventoryNeighborhoodIndex(documents, null, libraries);
  const training = { libraries, corpus: {
    texts: new Map(documents.map(doc => [doc.hash, null])),
    documents: [...index.groups.values()].map(row => ({ type: row.type, hash: row.hash,
      libraryIds: [...row.libraries].sort((a, b) => a - b) })).sort((a, b) => a.type.localeCompare(b.type) || a.hash.localeCompare(b.hash)),
  } };
  const digest = createHash('sha256').update(JSON.stringify([MULTI_SCALE_VERSION, representation.model, representation.digest,
    dimensions, [...held].sort(), training.libraries, training.corpus.documents]));
  return { training, dimensions, held: new Set(held), digest };
}
