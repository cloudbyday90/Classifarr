/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { inventoryDescriptionIdentity } from './inventoryDescriptionCorpus.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';
import { LIBRARY_MATCH_BASELINE_VERSION, LIBRARY_MATCH_BASELINE_LIMITS } from './libraryMatchBaseline.mjs';
import { splitLibraryMatchGroups } from './libraryMatchGroupSplit.mjs';

export const matchCalibrationDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Copy and validate a bounded private snapshot; caller mutations cannot change cached fits. */
export function prepareMatchCalibrationCorpus({ documents, libraries, vectors, representation }) {
  const representationKey = validateDescriptionRepresentation(representation);
  if (!Array.isArray(documents) || documents.length > 50000 || !Array.isArray(libraries) || libraries.length > 64 ||
      !(vectors instanceof Map) || vectors.size > 10000 || vectors.size * representation.dimensions > 20_000_000) {
    throw new Error('inventory_match_calibration_budget');
  }
  const media = new Map();
  for (const library of libraries) {
    if (!id(library?.id) || media.has(library.id) || !['movie', 'tv'].includes(library.media_type)) {
      throw new Error('inventory_match_calibration_library_invalid');
    }
    media.set(library.id, library.media_type);
  }
  const identities = new Map(), groups = new Map(), normalized = new Map();
  for (const doc of documents) {
    const key = inventoryDescriptionIdentity({ media_type: doc?.type, tmdb_id: doc?.id });
    if (doc.key !== key || identities.has(key) || !hash(doc.hash) || !Array.isArray(doc.libraryIds) ||
        !doc.libraryIds.length || new Set(doc.libraryIds).size !== doc.libraryIds.length ||
        doc.libraryIds.some(value => media.get(value) !== doc.type)) throw new Error('inventory_match_calibration_document_invalid');
    identities.set(key, doc.hash);
    if (!normalized.has(doc.hash)) normalized.set(doc.hash, normalizeDescriptionVector(vectors.get(doc.hash), representation.dimensions));
    const groupKey = `${doc.type}:${doc.hash}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { hash: doc.hash, mediaType: doc.type, libraryIds: new Set() });
    for (const value of doc.libraryIds) groups.get(groupKey).libraryIds.add(value);
  }
  const fingerprint = matchCalibrationDigest([LIBRARY_MATCH_BASELINE_VERSION, representationKey,
    LIBRARY_MATCH_BASELINE_LIMITS, [...media].sort(([a], [b]) => a - b),
    [...identities].sort(([a], [b]) => compare(a, b)), [...groups].sort(([a], [b]) => compare(a, b))
      .map(([key, group]) => [key, [...group.libraryIds].sort((a, b) => a - b)]),
    [...normalized].sort(([a], [b]) => compare(a, b))]);
  return { identities, groups, vectors: normalized, media, fingerprint, dimensions: representation.dimensions };
}

export function validateMatchCalibrationFold(corpus, mediaType, held) {
  if (!['movie', 'tv'].includes(mediaType) || !(held instanceof Set) || held.size > 10000 ||
      [...held].some(value => !hash(value) || !corpus.vectors.has(value))) throw new Error('inventory_match_calibration_fold_invalid');
}

/** Shared/copy groups cannot count as independent per-library training observations. */
export function splitMatchCalibrationGroups(corpus, mediaType, held) {
  validateMatchCalibrationFold(corpus, mediaType, held);
  return [...corpus.media].filter(([, type]) => type === mediaType).sort(([a], [b]) => a - b)
    .map(([libraryId]) => splitLibraryMatchGroups(corpus.groups.values(), libraryId, mediaType, held));
}
