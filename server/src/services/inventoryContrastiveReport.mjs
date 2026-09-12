/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export { summarizeDescriptionComparisons as summarizeContrastiveResults } from './inventoryDescriptionBenchmarkComparison.mjs';

/** No names, descriptions, item IDs, raw vectors or model text in the returned report. */
export function summarizeContrastivePairs(prepared, baseline) {
  const strata = new Map(prepared.libraryStrata?.map(entry => [entry.id, entry.stratum]) ?? []);
  const pairs = new Map();
  baseline.forEach((result, index) => {
    if (result.status !== 'proposed' || result.agreement) return;
    for (const id of prepared.cases[index].observedLibraryIds) {
      const observed = strata.get(id), proposed = strata.get(result.destinationId);
      if (!observed || !proposed) continue;
      const key = `${observed}:${proposed}`;
      if (!pairs.has(key)) pairs.set(key, { observedStratum: observed, proposedStratum: proposed, cases: 0 });
      pairs.get(key).cases++;
    }
  });
  return [...pairs.values()].sort((a, b) => b.cases - a.cases || a.observedStratum - b.observedStratum || a.proposedStratum - b.proposedStratum);
}
