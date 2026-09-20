/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { scoreNeighborReferences } from './libraryNeighborScoring.mjs';
import { NEIGHBOR_CROSS_FIT_LIMITS } from './libraryNeighborCrossFit.mjs';

/** Copy bounded diagnostics from the internal exact-retrieval pass, not a routing input. */
export function copyNeighborReferenceTargets(candidates, corpus, mediaType, held) {
  const ids = [...corpus.media].filter(([, type]) => type === mediaType).map(([id]) => id);
  if (!Array.isArray(candidates) || candidates.length !== ids.length ||
      new Set(candidates.map(row => row?.id)).size !== ids.length) throw new Error('neighbor_reference_targets_invalid');
  return candidates.map(candidate => {
    if (!ids.includes(candidate?.id) || !Number.isInteger(candidate.eligible) || candidate.eligible < 0 ||
        candidate.eligible > 10000 || !Array.isArray(candidate.items) || candidate.items.length !== Math.min(3, candidate.eligible) ||
        new Set(candidate.items.map(item => item?.hash)).size !== candidate.items.length) throw new Error('neighbor_reference_targets_invalid');
    return { libraryId: candidate.id, eligible: candidate.eligible, items: candidate.items.map(item => {
      const group = corpus.groups.get(`${mediaType}:${item?.hash}`);
      if (!group || held.has(item.hash) || group.libraryIds.size !== 1 || !group.libraryIds.has(candidate.id) ||
          !Number.isFinite(item.similarity) || item.similarity < -1 || item.similarity > 1) throw new Error('neighbor_reference_targets_invalid');
      return { hash: item.hash, similarity: item.similarity };
    }) };
  });
}

/** Measures coverage, not semantic accuracy. Only aggregate callers may serialize these rows. */
export function measureNeighborReferenceCoverage(groups, targets, query, consumeWork) {
  return groups.map(group => {
    const target = targets.find(row => row.libraryId === group.libraryId);
    const references = group.references.slice(0, NEIGHBOR_CROSS_FIT_LIMITS.references);
    const selected = new Set(references.map(row => row.hash));
    const complete = target.items.length === 3 && references.length >= 3;
    const gap = complete ? target.items.reduce((sum, item) => sum + item.similarity, 0) / 3 -
      scoreNeighborReferences(query, references.map(row => row.vector), consumeWork).mean : null;
    if (gap !== null && gap < -1e-8) throw new Error('neighbor_reference_targets_inconsistent');
    return { libraryId: group.libraryId, expected: target.items.length,
      recovered: target.items.filter(item => selected.has(item.hash)).length,
      meanSimilarityGap: gap === null ? null : Math.max(0, gap),
      selectionStatus: group.selectionStatus ?? 'ordered', selectionPool: group.selectionPool ?? group.references.length };
  });
}
