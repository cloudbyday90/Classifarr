/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { assertRepresentativeSnapshotBudget } from './inventoryRepresentativeCoverage.mjs';
import { createInventoryNeighborhoodIndex } from './inventoryNeighborhoodProfiles.mjs';
import { validateRepresentativeMembership, validatedRecoveryGroups } from './inventoryRepresentativeMembership.mjs';
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';

/** Private fold-local index. Never retain query copies, names, source identities or synopsis text. */
export async function createCandidateLocalIndex(snapshot, model, held, dimensions, signal) {
  assertRepresentativeSnapshotBudget(snapshot, dimensions);
  if (!(held instanceof Set) || !held.size) throw new Error('candidate_local_holdout_required');
  const documents = snapshot.corpus.documents.filter(doc => !held.has(doc.hash));
  const source = createInventoryNeighborhoodIndex(documents, snapshot.candidateMetadata, snapshot.libraries);
  if (model.libraries.size !== source.scope.size || [...source.scope].some(([id, type]) => model.libraries.get(id)?.mediaType !== type)) {
    throw new Error('candidate_local_scope_changed');
  }
  const vectors = new Map();
  for (const [hash, vector] of snapshot.vectors) if (!held.has(hash)) vectors.set(hash, normalizeDescriptionVector(vector, dimensions));
  const assignments = new Map();
  for (const [id, profile] of model.libraries) {
    signal?.throwIfAborted();
    const expected = new Set([...source.groups.values()].filter(row => row.libraries.size === 1 && row.libraries.has(id)).map(row => row.hash));
    // Unavailable alternatives stay in scope. Their absence cannot improve another candidate.
    if (profile.coverage.status !== 'complete' || profile.starts.some(start => !start.converged)) continue;
    validateRepresentativeMembership(profile, expected);
    const groups = await validatedRecoveryGroups(profile, vectors, dimensions, signal);
    if (!groups) continue;
    const smallest = Math.min(...groups.map(hashes => hashes.length)), largest = Math.max(...groups.map(hashes => hashes.length));
    assignments.set(id, new Map(groups.flatMap((hashes, index) => hashes.map(hash => [hash,
      { group: index, slice: hashes.length === smallest && smallest < largest ? 'smallest_supported_group' : 'other_supported_group' }]))));
  }
  const items = [...source.groups.values()].filter(row => row.libraries.size).map(row => {
    const id = row.libraries.size === 1 ? [...row.libraries][0] : null;
    return { type: row.type, hash: row.hash, id, vector: vectors.get(row.hash), metadata: row.metadata,
      ...(assignments.get(id)?.get(row.hash) ?? { group: null, slice: 'unassigned' }) };
  });
  if (items.some(row => !row.vector)) throw new Error('candidate_local_complete_cache_required');
  signal?.throwIfAborted();
  return { scope: source.scope, available: new Set(assignments.keys()), items, dimensions, held: new Set(held) };
}

/** Bounded top-three retrieval, retaining unassigned and shared examples as competition. */
export async function retrieveCandidateLocalEvidence(index, { type, hash, vector }, signal) {
  if (!index.held.has(hash)) throw new Error('candidate_local_holdout_required');
  const query = normalizeDescriptionVector(vector, index.dimensions);
  const candidates = [...index.scope].filter(([, mediaType]) => mediaType === type).map(([id]) => ({ id, items: [] }));
  const byId = new Map(candidates.map(row => [row.id, row]));
  let sharedMaximum = -1, nearest = null, processed = 0;
  for (const item of index.items) {
    if (processed++ % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
    if (item.type !== type) continue;
    const similarity = descriptionCosineSimilarity(query, item.vector);
    if (item.id === null) { sharedMaximum = Math.max(sharedMaximum, similarity); continue; }
    const row = { ...item, similarity };
    if (!nearest || similarity > nearest.similarity || (similarity === nearest.similarity && item.hash < nearest.hash)) nearest = row;
    const items = byId.get(item.id).items;
    items.push(row);
    items.sort((a, b) => b.similarity - a.similarity || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
    if (items.length > 3) items.pop();
  }
  signal?.throwIfAborted();
  return { candidates, sharedMaximum, slice: nearest?.slice ?? 'unavailable',
    complete: candidates.length >= 2 && candidates.every(row => index.available.has(row.id)), query };
}
