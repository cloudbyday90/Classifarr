/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const INVENTORY_DESCRIPTION_ANCHOR_VERSION = 'description_candidate_anchor_v1';
const validId = id => Number.isInteger(id) && id > 0 && id <= 2147483647;

/** A complete, closed comparison can nominate one candidate, never authorize routing. */
export function findInventoryDescriptionAnchor(order, evidence) {
  if (!Array.isArray(order) || order.length < 2 || order.length > 64 || !order.every(validId) ||
      new Set(order).size !== order.length || !Array.isArray(evidence) || evidence.length !== order.length ||
      new Set(evidence.map(candidate => candidate?.libraryId)).size !== order.length) return null;
  const ranked = [];
  for (const candidate of evidence) {
    if (!order.includes(candidate?.libraryId) || !Number.isInteger(candidate.eligible) ||
        candidate.eligible < 0 || candidate.eligible > 10000 || candidate.indexed !== candidate.eligible ||
        !Array.isArray(candidate.items) || candidate.items.length !== Math.min(3, candidate.eligible) ||
        candidate.items.some(item => typeof item?.description !== 'string' || !item.description.trim() ||
          item.description.length > 2000 || !Number.isFinite(item.similarity) || Math.abs(item.similarity) > 1 ||
          typeof item.sharedAcrossCandidates !== 'boolean') ||
        new Set(candidate.items.map(item => item.description.trim().toLowerCase())).size !== candidate.items.length) return null;
    ranked.push({ candidate, mean: candidate.items.length
      ? candidate.items.reduce((sum, item) => sum + item.similarity, 0) / candidate.items.length : -2 });
  }
  ranked.sort((a, b) => b.mean - a.mean);
  const [first, second] = ranked;
  return first.mean > 0 && first.mean > second.mean && first.candidate.items.length === 3 &&
    first.candidate.items.every(item => !item.sharedAcrossCandidates) ? first.candidate.libraryId : null;
}

/** Preserve the first two choices and their order; rescue an omitted description leader. */
export function preserveInventoryDescriptionCandidate(order, evidence) {
  const anchor = findInventoryDescriptionAnchor(order, evidence);
  if (anchor === null || order.slice(0, 3).includes(anchor)) return order;
  return [...order.slice(0, 2), anchor, ...order.slice(2).filter(id => id !== anchor)];
}
