/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { splitLibraryMatchGroups } from './libraryMatchGroupSplit.mjs';
import { fitLibraryMatchBaseline, LIBRARY_MATCH_BASELINE_VERSION, LIBRARY_MATCH_BASELINE_LIMITS } from './libraryMatchBaseline.mjs';
import { inventoryDescriptionQueryExcludedHashes } from './inventoryDescriptionQueryExclusions.mjs';
import { createInventoryDescriptionVectorCache, validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';

/** Fit only the proposed library, inside the caller's read-only inventory snapshot. */
export async function assessLiveLibraryMatch({ rows, corpus, request, identity, vector, query, signal }) {
  const libraryId = request.matchLibraryId;
  if (!request.libraryIds.includes(libraryId)) throw new Error('live_match_scope_invalid');
  const representation = validateDescriptionRepresentation(identity);
  const groups = new Map();
  for (const doc of corpus.documents) {
    if (doc.type !== request.mediaType) continue;
    if (!groups.has(doc.hash)) groups.set(doc.hash, { hash: doc.hash, mediaType: doc.type, libraryIds: new Set() });
    for (const id of doc.libraryIds) groups.get(doc.hash).libraryIds.add(id);
  }
  const held = inventoryDescriptionQueryExcludedHashes(rows, request);
  const split = splitLibraryMatchGroups(groups.values(), libraryId, request.mediaType, held);
  const { references, calibration, ...counts } = split;
  const summary = { version: LIBRARY_MATCH_BASELINE_VERSION, ...counts,
    referenceDescriptions: references.length, calibrationDescriptions: calibration.length };
  if (references.length < LIBRARY_MATCH_BASELINE_LIMITS.minimum || calibration.length < LIBRARY_MATCH_BASELINE_LIMITS.minimum) {
    return { ...summary, status: 'sparse', empiricalRank: null };
  }
  signal?.throwIfAborted();
  const hashes = [...references, ...calibration];
  const vectors = await createInventoryDescriptionVectorCache({ query }).read(identity, hashes);
  if (vectors.size !== hashes.length) return { ...summary, status: 'incomplete', empiricalRank: null };
  let operations = 0;
  const baseline = await fitLibraryMatchBaseline(references.map(hash => vectors.get(hash)),
    calibration.map(hash => vectors.get(hash)), identity.dimensions, { signal, consumeWork: count => {
      operations += count;
      if (operations > 100_000_000) throw new Error('live_match_work_budget');
    } });
  signal?.throwIfAborted();
  const snapshotId = createHash('sha256').update(JSON.stringify([
    summary, representation, request.key, request.hash, vector, [...held].sort(), split,
    hashes.map(hash => [hash, vectors.get(hash)]),
  ])).digest('hex');
  return { ...summary, ...baseline.assess(vector), snapshotId };
}
