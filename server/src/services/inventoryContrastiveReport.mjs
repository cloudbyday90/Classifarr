/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const numericSummary = values => ({ count: values.length,
  mean: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null });

export function summarizeContrastiveResults(results) {
  const valid = results.filter(result => ['proposed', 'abstained'].includes(result.status));
  return { finished: results.length, valid: valid.length, agreed: valid.filter(result => result.agreement).length,
    statuses: Object.fromEntries(['proposed', 'abstained', 'invalid_or_limited', 'failed', 'context_budget', 'evidence_unavailable']
      .map(status => [status, results.filter(result => result.status === status).length])),
    latencyMs: numericSummary(results.flatMap(result => Number.isFinite(result.latencyMs) ? [result.latencyMs] : [])),
    promptTokens: numericSummary(results.flatMap(result => Number.isFinite(result.promptTokens) ? [result.promptTokens] : [])) };
}

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
