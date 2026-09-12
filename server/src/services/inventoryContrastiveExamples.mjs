/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeDescriptionVector, descriptionCosineSimilarity } from './inventoryDescriptionSimilarity.mjs';
import { fuseInventoryCandidateRanks } from './inventoryCandidateRankFusion.mjs';

const meanTopThree = values => values.sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0) / 3;

/** Experimental within-versus-between library evidence, never a routing score. */
export function selectContrastiveLibraryExamples(entry, vectors) {
  const candidates = entry.candidates;
  if (!Array.isArray(candidates) || candidates.length < 2 || candidates.length > 3 ||
      new Set(candidates.map(candidate => candidate.id)).size !== candidates.length ||
      candidates.some(candidate => !Number.isInteger(candidate.id) || candidate.id < 1 || candidate.id > 2147483647 ||
        candidate.media_type !== entry.mediaType || !Array.isArray(candidate.items) || candidate.items.length > 100 ||
        candidate.items.some(item => !/^[a-f0-9]{64}$/.test(item.hash) || !(item.libraryIds instanceof Set))) ||
      !(entry.heldDescriptionHashes instanceof Set) || !entry.heldDescriptionHashes.has(entry.descriptionHash)) {
    return { status: 'invalid_scope' };
  }
  if (candidates.some(candidate => candidate.items.some(item => entry.heldDescriptionHashes.has(item.hash)))) {
    return { status: 'holdout_violation' };
  }
  const pools = candidates.map(candidate => [...new Map(candidate.items.slice(0, 30).map(item => [item.hash, item])).values()]
    .filter(item => !candidates.some(other => other.id !== candidate.id &&
      (item.libraryIds?.has(other.id) || other.items.some(value => value.hash === item.hash)))));
  if (pools.some(pool => pool.length < 4)) return { status: 'insufficient_distinct_examples' };
  const normalized = new Map();
  try {
    let dimensions;
    for (const item of pools.flat()) {
      const vector = vectors?.get(item.hash);
      dimensions ??= vector?.length;
      if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 4096) return { status: 'invalid_vectors' };
      normalized.set(item.hash, normalizeDescriptionVector(vector, dimensions));
    }
  } catch { return { status: 'invalid_vectors' }; }
  const similarityCache = new Map();
  const similarity = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!similarityCache.has(key)) similarityCache.set(key, descriptionCosineSimilarity(normalized.get(a), normalized.get(b)));
    return similarityCache.get(key);
  };
  let positiveMargins = 0, replacedExamples = 0;
  const selected = candidates.map((candidate, index) => {
    const scores = pools[index].map(item => {
      const own = meanTopThree(pools[index].filter(other => other.hash !== item.hash).map(other => similarity(item.hash, other.hash)));
      const alternative = Math.max(...pools.filter((_, other) => other !== index)
        .map(pool => meanTopThree(pool.map(other => similarity(item.hash, other.hash)))));
      const score = own - alternative;
      if (score > 0) positiveMargins++;
      return { id: item.hash, score };
    });
    const ranked = pools[index].map(item => ({ id: item.hash, item }));
    const items = fuseInventoryCandidateRanks(ranked, scores).slice(0, 3).map(value => value.item);
    replacedExamples += items.filter(item => !candidate.items.slice(0, 3).some(original => original.hash === item.hash)).length;
    return { ...candidate, items };
  });
  return { status: 'available', candidates: selected,
    summary: { comparedExamples: pools.flat().length, positiveMargins, replacedExamples, selectedExamples: selected.length * 3 } };
}
