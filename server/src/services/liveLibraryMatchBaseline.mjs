/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { splitLibraryMatchGroups } from './libraryMatchGroupSplit.mjs';
import { fitLibraryMatchBaseline, LIBRARY_MATCH_BASELINE_VERSION, LIBRARY_MATCH_BASELINE_LIMITS } from './libraryMatchBaseline.mjs';
import { inventoryDescriptionQueryExcludedHashes } from './inventoryDescriptionQueryExclusions.mjs';
import { createInventoryDescriptionVectorCache, validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';

// Separate closure: a cached model must not retain a request's corpus or transaction.
function createWorkBudget() {
  let operations = 0;
  return count => {
    operations += count;
    if (operations > 100_000_000) throw new Error('live_match_work_budget');
  };
}

/** Revalidate actual vectors before reusing a proposed-library fit in this read snapshot. */
export async function assessLiveLibraryMatch({ rows, corpus, request, identity, vector, query, signal, modelCache }) {
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
  signal?.throwIfAborted();
  if (vectors.size !== hashes.length) return { ...summary, status: 'incomplete', empiricalRank: null };
  const consumeWork = createWorkBudget();
  const fitKey = createHash('sha256').update(JSON.stringify([
    LIBRARY_MATCH_BASELINE_VERSION, representation, request.mediaType, libraryId, references, calibration,
    hashes.map(hash => [hash, vectors.get(hash)]),
  ])).digest('hex');
  let baseline = modelCache?.get(fitKey);
  const cached = Boolean(baseline);
  if (!baseline) baseline = await fitLibraryMatchBaseline(references.map(hash => vectors.get(hash)),
    calibration.map(hash => vectors.get(hash)), identity.dimensions, { signal, consumeWork });
  signal?.throwIfAborted();
  const snapshotId = createHash('sha256').update(JSON.stringify([
    summary, representation, request.key, request.hash, vector, [...held].sort(), split,
    hashes.map(hash => [hash, vectors.get(hash)]),
  ])).digest('hex');
  const assessment = baseline.assess(vector, { consumeWork });
  if (!cached && baseline.summary.status === 'available') {
    modelCache?.set(fitKey, baseline, 1024 + references.length * (64 + identity.dimensions * 8) + calibration.length * 8);
  }
  return { ...summary, ...assessment, snapshotId };
}
