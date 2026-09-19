/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector } from './inventoryDescriptionSimilarity.mjs';
import { representativeSimilarity as similarity } from './representativeFitSession.mjs';
import { compareNearestGroups } from './inventoryGroupQuality.mjs';

const rank = (a, b) => b.similarity - a.similarity || a.hash.localeCompare(b.hash);
function nearestGroup(groups, query) {
  let best = null;
  for (const group of groups) {
    const score = similarity(query, group.centroid);
    if (!best || score > best.score) best = { group, score };
  }
  return best;
}

/** Returns fresh bounded evidence, never vectors, stored content or routing authority. */
export async function retrieveMultiScaleContext(state, { type, hash, vector }, signal) {
  signal?.throwIfAborted();
  const admitted = state.held.size ? state.held.has(hash)
    : typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) && state.knownHashes && !state.knownHashes.has(hash);
  if (!admitted || !['movie', 'tv'].includes(type)) throw new Error('multi_scale_holdout_required');
  const query = normalizeDescriptionVector(vector, state.dimensions);
  const candidates = state.libraries.filter(row => row.mediaType === type).map(row => ({ id: row.id, raw: [] }));
  const byId = new Map(candidates.map(row => [row.id, row])), shared = [], scores = new Map();
  let nearest = null, processed = 0;
  for (const row of state.items) {
    if (processed++ % 128 === 0) { await setImmediate(); signal?.throwIfAborted(); }
    if (row.type !== type) continue;
    const item = { hash: row.hash, similarity: similarity(query, row.vector) };
    scores.set(row.hash, item.similarity);
    if (!nearest || rank(item, nearest) < 0) nearest = { ...item, grouped: state.localMembership.has(`${type}:${row.hash}`) };
    const target = row.id === null ? shared : byId.get(row.id).raw;
    target.push(item); target.sort(rank); if (target.length > 3) target.pop();
  }
  for (const candidate of candidates) {
    const library = state.libraries.find(row => row.id === candidate.id);
    const broad = nearestGroup(library.groups, query);
    const rawHashes = new Set(candidate.raw.map(row => row.hash));
    const local = nearestGroup(library.localGroups.filter(group => group.hashes.some(member => rawHashes.has(member))), query);
    const evidence = new Map();
    const add = (hash, origin) => {
      if (!evidence.has(hash)) evidence.set(hash, { hash, similarity: scores.get(hash), origins: [] });
      evidence.get(hash).origins.push(origin);
    };
    candidate.raw.forEach(row => add(row.hash, 'raw'));
    broad?.group.representatives.forEach(hash => add(hash, 'broad'));
    if (local?.score > 0) local.group.representatives.forEach(hash => add(hash, 'local'));
    candidate.evidence = [...evidence.values()].sort(rank);
    candidate.broadAvailable = library.available;
    candidate.broad = broad ? { similarity: broad.score, support: broad.group.support } : null;
    candidate.local = local?.score > 0 ? { similarity: local.score, support: local.group.support } : null;
  }
  const { reason, id } = compareNearestGroups(state.libraries, type, query, []);
  signal?.throwIfAborted();
  return { purpose: 'retrieval_context_only', candidates, shared, nearestGrouped: nearest?.grouped ?? false,
    baseline: { reason, ...(id === undefined ? {} : { id }) }, localStatus: state.localStatus };
}
