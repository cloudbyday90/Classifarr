/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const rank = value => createHash('sha256').update(value).digest('hex');
const textValid = value => typeof value === 'string' && value.trim().length > 0 && [...value].length <= 2000;
const boundedTerm = value => typeof value === 'string' && value.length <= 120 && value.trim().length > 0;
const observation = (description, metadata) => ({ description, observedMetadata: {
  genres: Array.isArray(metadata?.genres) && metadata.genres.length <= 20 && metadata.genres.every(boundedTerm)
    ? [...metadata.genres].sort() : [], studio: boundedTerm(metadata?.studio) ? metadata.studio : null,
} });

/** Fold-private group centroids. Membership has already passed the local index's validation. */
export async function createGroupSemanticIndex(index, signal) {
  const groups = new Map();
  for (const item of index.items) {
    if (index.held.has(item.hash)) throw new Error('semantic_group_holdout_leak');
    if (item.id === null || item.group === null) continue;
    const key = `${item.id}:${item.group}`;
    if (!groups.has(key)) groups.set(key, { id: item.id, type: item.type, items: [], sum: Array(index.dimensions).fill(0) });
    const group = groups.get(key);
    group.items.push(item);
    item.vector.forEach((value, component) => { group.sum[component] += value; });
  }
  const result = [];
  for (const { sum, ...group } of groups.values()) {
    await setImmediate(); signal?.throwIfAborted();
    result.push({ ...group, centroid: normalizeDescriptionVector(sum, index.dimensions) });
  }
  signal?.throwIfAborted();
  return { source: index, groups: result };
}

/** Anonymous group evidence; no observed placement enters selection or the prompt. */
export function prepareGroupSemanticPlan(index, doc, texts, evidence, metadata) {
  if (!index.source.held.has(doc.hash)) throw new Error('semantic_group_holdout_required');
  const ids = [...index.source.scope].filter(([, type]) => type === doc.type).map(([id]) => id);
  if (!evidence.complete || ids.length < 2 || ids.length > 8 || evidence.candidates.length !== ids.length ||
      new Set(evidence.candidates.map(row => row.id)).size !== ids.length || evidence.candidates.some(row => !ids.includes(row.id))) {
    return { status: 'semantic_incomplete_scope' };
  }
  if (evidence.candidates.some(row => row.items.length !== 3 || row.items[0].group === null)) return { status: 'semantic_incomplete_groups' };
  if (evidence.sharedMaximum >= 0.98 || evidence.candidates.some(row => row.items[0].similarity >= 0.98)) return { status: 'semantic_correlated_query' };
  if (!textValid(texts.get(doc.hash))) return { status: 'semantic_missing_description' };
  const candidates = [];
  for (const id of ids) {
    const groups = index.groups.filter(group => group.id === id && group.type === doc.type)
      .map(group => ({ ...group, similarity: descriptionCosineSimilarity(group.centroid, evidence.query) }))
      .sort((a, b) => b.similarity - a.similarity);
    const winner = groups[0];
    if (!winner || winner.items.length < 3 || winner.similarity <= 0 ||
        (groups[1] && winner.similarity - groups[1].similarity <= 1e-12)) return { status: 'semantic_ambiguous_group' };
    // Score once per member, not once per sort comparison (vectors may have thousands of dimensions).
    const scored = winner.items.map(item => ({ item, centrality: descriptionCosineSimilarity(item.vector, winner.centroid),
      similarity: descriptionCosineSimilarity(item.vector, evidence.query) }));
    const central = scored.sort((a, b) => b.centrality - a.centrality || compare(a.item.hash, b.item.hash))[0].item;
    const nearby = scored.filter(row => row.item.hash !== central.hash).sort((a, b) =>
      b.similarity - a.similarity || compare(a.item.hash, b.item.hash)).slice(0, 2).map(row => row.item);
    const examples = [central, ...nearby];
    if (new Set(examples.map(item => item.hash)).size !== 3 || examples.some((a, i) => examples.slice(i + 1)
      .some(b => descriptionCosineSimilarity(a.vector, b.vector) >= 0.98))) return { status: 'semantic_correlated_examples' };
    if (examples.some(item => !textValid(texts.get(item.hash)))) return { status: 'semantic_missing_description' };
    candidates.push({ id, order: rank(`${doc.hash}:${examples.map(item => item.hash).sort().join(':')}`),
      examples: examples.map(item => observation(texts.get(item.hash), item.metadata)) });
  }
  candidates.sort((a, b) => compare(a.order, b.order));
  return { status: 'ready', query: { mediaType: doc.type, ...observation(texts.get(doc.hash), metadata) },
    candidates: candidates.map(({ id, examples }) => ({ id, examples })) };
}
