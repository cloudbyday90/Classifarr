/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { splitLibraryMatchGroups } from './libraryMatchGroupSplit.mjs';
import { fitLibraryNeighborCrossFit, selectNeighborCrossFitGroups, NEIGHBOR_CROSS_FIT_VERSION, NEIGHBOR_CROSS_FIT_LIMITS } from './libraryNeighborCrossFit.mjs';
import { inventoryDescriptionQueryExcludedHashes } from './inventoryDescriptionQueryExclusions.mjs';
import { createInventoryDescriptionVectorCache, validateDescriptionRepresentation } from './inventoryDescriptionVectorCache.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// A cached kernel must not retain a transaction, corpus, request or signal.
function workBudget() {
  let used = 0;
  return count => { used += count; if (used > 100_000_000) throw new Error('live_neighbor_work_budget'); };
}

/** Current private snapshot only. This assessment cannot authorize a route. */
export async function assessLiveLibraryNeighbors({ rows, corpus, request, identity, vector, query, signal, modelCache }) {
  const ids = [...request.libraryIds].sort((a, b) => a - b), limits = NEIGHBOR_CROSS_FIT_LIMITS;
  if (ids.length < 2 || ids.length > 64 || new Set(ids).size !== ids.length ||
      ids.some(id => !Number.isInteger(id) || id < 1 || id > 2147483647) || !ids.includes(request.matchLibraryId)) {
    throw new Error('live_neighbor_scope_invalid');
  }
  const representation = validateDescriptionRepresentation(identity), groups = new Map();
  for (const doc of corpus.documents) {
    if (doc.type !== request.mediaType) continue;
    if (!groups.has(doc.hash)) groups.set(doc.hash, { hash: doc.hash, mediaType: doc.type, libraryIds: new Set() });
    for (const id of doc.libraryIds) groups.get(doc.hash).libraryIds.add(id);
  }
  const held = inventoryDescriptionQueryExcludedHashes(rows, request);
  const splits = ids.map(id => splitLibraryMatchGroups(groups.values(), id, request.mediaType, held));
  const hashes = splits.flatMap(split => [...split.calibration, ...split.references].slice(0, limits.pool));
  if (hashes.length * identity.dimensions > limits.modelVectorComponents) throw new Error('live_neighbor_vector_budget');
  signal?.throwIfAborted();
  const vectors = await createInventoryDescriptionVectorCache({ query }).read(identity, hashes);
  signal?.throwIfAborted();
  if (vectors.size !== hashes.length) return { version: NEIGHBOR_CROSS_FIT_VERSION, status: 'incomplete', candidates: [] };
  const selected = selectNeighborCrossFitGroups(splits, vectors);
  const key = digest([NEIGHBOR_CROSS_FIT_VERSION, limits, representation, request.mediaType, selected]);
  let model = modelCache?.get(key);
  const cached = Boolean(model), consumeWork = workBudget();
  if (!model) model = await fitLibraryNeighborCrossFit(selected, identity.dimensions, { signal, consumeWork });
  signal?.throwIfAborted();
  const candidates = model.assess(vector, { consumeWork });
  const snapshotId = digest([key, request.key, request.hash, vector, [...held].sort(), splits]);
  if (!cached && candidates.every(candidate => candidate.status === 'available')) {
    modelCache?.set(key, model, 2048 + hashes.length * (256 + identity.dimensions * 8) + ids.length * 1024);
  }
  return { version: NEIGHBOR_CROSS_FIT_VERSION, status: 'evaluated', snapshotId, candidates };
}
