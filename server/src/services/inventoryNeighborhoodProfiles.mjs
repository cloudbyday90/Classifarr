/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { learnInventoryProfiles, scoreInventoryProfile } from './inventoryLearnedProfiles.mjs';

export const INVENTORY_NEIGHBORHOOD_PROFILE_VERSION = 'inventory_neighborhood_profile_v1';
const usable = value => Boolean(value && (value.genres?.length || value.studio || value.rating));

/** Index normalized private metadata once; duplicate copies must agree. Never uses library names. */
export function createInventoryNeighborhoodIndex(documents, metadata, libraries) {
  if (documents.length > 50000 || libraries.length > 64 || new Set(libraries.map(row => row.id)).size !== libraries.length ||
      libraries.some(row => !Number.isSafeInteger(row.id) || row.id < 1 || !['movie', 'tv'].includes(row.media_type))) {
    throw new Error('inventory_neighborhood_index_invalid');
  }
  const scope = new Map(libraries.map(row => [row.id, row.media_type])), groups = new Map();
  for (const doc of documents) {
    const key = `${doc.type}:${doc.hash}`, value = metadata?.get(doc.key) ?? null;
    if (!groups.has(key)) groups.set(key, { type: doc.type, hash: doc.hash, metadata: value, libraries: new Set() });
    const group = groups.get(key);
    if (JSON.stringify(group.metadata) !== JSON.stringify(value)) group.metadata = null;
    for (const id of doc.libraryIds) if (scope.get(id) === doc.type) group.libraries.add(id);
  }
  return { scope, groups };
}

/** Fit only distinct exclusive neighbors outside the entire hold-out. No partial-pool comparison. */
export function scoreInventoryNeighborhoodProfiles(index, entry, queryMetadata) {
  const held = entry.heldDescriptionHashes, candidates = entry.investigationCandidates;
  const ids = [...index.scope].filter(([, type]) => type === entry.mediaType).map(([id]) => id);
  if (!(held instanceof Set) || !held.has(entry.descriptionHash)) throw new Error('inventory_neighborhood_holdout_required');
  if (candidates.length < 2 || candidates.length !== ids.length || new Set(candidates.map(row => row.id)).size !== ids.length ||
      candidates.some(row => !ids.includes(row.id) || row.media_type !== entry.mediaType || !Array.isArray(row.items) ||
        row.items.length > 100 || row.items.some(item => item.type !== entry.mediaType || typeof item.hash !== 'string' ||
          !Number.isFinite(item.similarity) || item.similarity < -1 || item.similarity > 1))) {
    throw new Error('inventory_neighborhood_candidates_invalid');
  }
  if (!usable(queryMetadata)) return { status: 'missing_query_metadata', support: [], scores: [] };
  const documents = [], metadata = new Map(), support = [];
  for (const candidate of candidates) {
    const seen = new Set();
    const ordered = [...candidate.items].sort((a, b) => b.similarity - a.similarity || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
    for (const item of ordered) {
      if (seen.size === 20) break;
      const key = `${entry.mediaType}:${item.hash}`, group = index.groups.get(key);
      if (held.has(item.hash) || seen.has(item.hash) || !group || group.libraries.size !== 1 ||
          !group.libraries.has(candidate.id) || !usable(group.metadata)) continue;
      seen.add(item.hash);
      documents.push({ key, hash: item.hash, type: entry.mediaType, libraryIds: [candidate.id] });
      metadata.set(key, group.metadata);
    }
    support.push(seen.size);
  }
  if (support.some(count => count < 10)) return { status: 'sparse_neighborhood', support, scores: [] };
  const libraries = ids.map(id => ({ id, media_type: entry.mediaType }));
  const model = learnInventoryProfiles(documents, metadata, libraries, held);
  const scores = ids.map(id => ({ id, profileFit: scoreInventoryProfile(model, id, queryMetadata) }));
  return { status: scores.some(row => row.profileFit > 0) ? 'scored' : 'uninformative_neighborhood', support, scores };
}
