/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createInventoryNeighborhoodIndex } from './inventoryNeighborhoodProfiles.mjs';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { fitRepresentativeGeometry, representativeSimilarity, REPRESENTATIVE_MAX_GROUPS, REPRESENTATIVE_MAX_PASSES } from './inventoryRepresentativeGeometry.mjs';
import { rankInventoryEvidence } from './inventoryEvidenceReranker.mjs';
import { inventoryEvidenceLeaderState } from './inventoryNeighborhoodReranker.mjs';

export const INVENTORY_REPRESENTATIVE_VERSION = 'inventory_representative_groups_v1';

/** Private reusable vectors/membership only; no singleton and no library-name features. */
export function createInventoryRepresentativeIndex(snapshot, dimensions, folds = 1) {
  if (!Number.isSafeInteger(dimensions) || dimensions < 1 || dimensions > 16000 ||
      !Number.isSafeInteger(folds) || folds < 1 || folds > 10 ||
      snapshot.corpus.texts.size * dimensions > 20_000_000 ||
      snapshot.corpus.documents.length * dimensions * REPRESENTATIVE_MAX_GROUPS * (REPRESENTATIVE_MAX_PASSES + 2) * folds > 20_000_000_000) {
    throw new Error('inventory_representative_work_budget');
  }
  const index = createInventoryNeighborhoodIndex(snapshot.corpus.documents, null, snapshot.libraries);
  if ([...index.groups.values()].some(group => !/^[a-f0-9]{64}$/.test(group.hash))) throw new Error('inventory_representative_identity_invalid');
  const vectors = new Map([...snapshot.corpus.texts.keys()].map(hash => [hash, normalizeDescriptionVector(snapshot.vectors.get(hash), dimensions)]));
  return { ...index, vectors };
}

/** Hold-out copies are excluded BEFORE fitting; shared descriptions never supply multiple votes. */
export async function learnInventoryRepresentativeGroups(index, held, { signal } = {}) {
  if (!(held instanceof Set) || !held.size) throw new Error('inventory_representative_holdout_required');
  signal?.throwIfAborted();
  const buckets = new Map([...index.scope.keys()].sort((a, b) => a - b).map(id => [id, []]));
  const summary = { eligibleDescriptions: 0, heldDescriptions: 0, sharedDescriptions: 0, unscopedDescriptions: 0,
    supportedDescriptions: 0, discardedDescriptions: 0, groups: 0, sparseLibraries: 0, iterationLimitLibraries: 0, maximumIterations: 0 };
  for (const group of index.groups.values()) {
    if (held.has(group.hash)) { summary.heldDescriptions++; continue; }
    if (!group.libraries.size) { summary.unscopedDescriptions++; continue; }
    if (group.libraries.size > 1) { summary.sharedDescriptions++; continue; }
    const vector = index.vectors.get(group.hash);
    if (!vector) throw new Error('inventory_representative_vector_missing');
    buckets.get([...group.libraries][0]).push({ hash: group.hash, vector });
    summary.eligibleDescriptions++;
  }
  const libraries = new Map(), coverage = new Map();
  for (const [id, items] of buckets) {
    items.sort((a, b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0);
    const result = await fitRepresentativeGeometry(items, { signal });
    libraries.set(id, result.groups);
    coverage.set(id, { trainingDescriptions: items.length, discardedDescriptions: result.discarded,
      iterations: result.iterations, converged: result.converged,
      groups: result.groups.map(group => ({ support: group.support, meanSimilarity: Math.round(group.meanSimilarity * 10000) / 10000 })) });
    summary.groups += result.groups.length;
    summary.discardedDescriptions += result.discarded;
    summary.sparseLibraries += Number(!result.groups.length);
    summary.iterationLimitLibraries += Number(!result.converged);
    summary.maximumIterations = Math.max(summary.maximumIterations, result.iterations);
  }
  summary.supportedDescriptions = summary.eligibleDescriptions - summary.discardedDescriptions;
  return { libraries, coverage, scope: index.scope, vectors: index.vectors, held: new Set(held), summary };
}

/** Rank only complete, matching-fold pools. This is similarity, never route authority. */
export function rankInventoryRepresentativeEvidence(model, row) {
  const { entry, candidates } = row, held = entry.heldDescriptionHashes;
  if (!(held instanceof Set) || !held.has(entry.descriptionHash) || held.size !== model.held.size || [...held].some(hash => !model.held.has(hash))) {
    throw new Error('inventory_representative_fold_mismatch');
  }
  const ids = [...model.scope].filter(([, type]) => type === entry.mediaType).map(([id]) => id);
  if (candidates.length !== ids.length || candidates.some(candidate => !ids.includes(candidate.id))) throw new Error('inventory_representative_scope_mismatch');
  const baseline = rankInventoryEvidence(candidates), state = inventoryEvidenceLeaderState(candidates);
  if (state !== 'disagreement') return { ranking: baseline, status: state };
  const query = model.vectors.get(entry.descriptionHash);
  if (!query) throw new Error('inventory_representative_query_missing');
  if (ids.some(id => !model.libraries.get(id)?.length)) return { ranking: baseline, status: 'sparse_groups' };
  const scored = candidates.map(candidate => ({ ...candidate,
    description: Math.max(...model.libraries.get(candidate.id).map(group => representativeSimilarity(query, group.centroid))) }));
  const leaders = [...scored].sort((a, b) => b.description - a.description);
  if (leaders[0].description <= 0 || leaders[0].description - leaders[1].description <= 1e-12) {
    return { ranking: baseline, status: 'ambiguous_groups' };
  }
  return { ranking: rankInventoryEvidence(scored), status: 'scored' };
}
