/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
/** Private, label-free proposal shared by the neighbor and fresh-policy experiments. */
export function inspectInventoryNeighborProposal(entry, texts) {
  const [selected, ...others] = [...entry.investigationCandidates].sort((a, b) => b.rank - a.rank || a.id - b.id);
  const complete = others.length > 0 && [selected, ...others].every(candidate => candidate.items.length >= 3);
  const unique = complete && selected.rank > others[0].rank;
  const normalized = hash => texts.get(hash).trim().toLowerCase();
  const otherDescriptions = new Set(others.flatMap(candidate => candidate.items.slice(0, 3).map(item => normalized(item.hash))));
  const items = selected?.items.slice(0, 3) ?? [];
  const shared = unique && items.some(item => item.libraryIds.size > 1 || otherDescriptions.has(normalized(item.hash)));
  const strict = unique && !shared && Math.min(...items.map(item => item.similarity)) >
    Math.max(...others.flatMap(candidate => candidate.items.slice(0, 3).map(item => item.similarity)));
  return { selected: unique ? selected.id : null, shared, strict };
}
