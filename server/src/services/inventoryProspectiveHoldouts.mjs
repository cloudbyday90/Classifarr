/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { inventoryRankingItemIdentity } from './inventoryRankingShadowIdentity.mjs';
import { readClassificationDestinationDecision } from './classificationDestinationDecision.mjs';

/** Plan all alias bridges before grading. Exclusion aliases never repair a scorable identity. */
export function planProspectiveHoldouts(rows) {
  const parents = rows.map((_, index) => index), anchors = new Map();
  function root(index) {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
    return index;
  }
  rows.forEach((row, index) => {
    if (!row.validCapture) return;
    const original = readClassificationDestinationDecision(row.original_decision);
    const aliases = [row.capture.identityKey, inventoryRankingItemIdentity(row),
      original && inventoryRankingItemIdentity({ media_type: original.mediaType, tmdb_id: original.tmdbId }),
      ...row.prepared.aliases];
    const tokens = [`description:${row.capture.queryHash}`, ...aliases.filter(Boolean).map(key => `identity:${key}`)];
    for (const token of tokens) {
      if (!anchors.has(token)) anchors.set(token, index);
      const a = root(index), b = root(anchors.get(token));
      parents[Math.max(a, b)] = Math.min(a, b);
    }
  });
  // The caller supplies chronological rows, so the smallest index is the earliest.
  return rows.map((row, index) => row.validCapture && root(index) === index);
}
