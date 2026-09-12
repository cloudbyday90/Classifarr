/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Equal evidence shares a rank; tie breaks preserve synopsis order. */
export function fuseInventoryCandidateRanks(ranked, scores) {
  const positive = scores.filter(entry => Number.isFinite(entry.score) && entry.score > 0);
  if (!positive.length) return ranked;
  const ranks = new Map(positive.map(entry => [entry.id, 1 + positive.filter(other => other.score > entry.score).length]));
  return ranked.map((candidate, index) => ({ candidate, index,
    score: 1 / (60 + index + 1) + (ranks.has(candidate.id) ? 1 / (60 + ranks.get(candidate.id)) : 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index).map(entry => entry.candidate);
}
