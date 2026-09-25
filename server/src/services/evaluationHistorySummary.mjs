/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validEvaluationHistory } from './evaluationHistoryContract.mjs';
import { summarizeEvaluationGaps } from './evaluationCoverageGaps.mjs';

/** Newest-first, bounded private rows in; explicit aggregate allowlist out. */
export function projectEvaluationHistory(rows) {
  if (!Array.isArray(rows) || rows.length > 500 || rows.some(row => !validEvaluationHistory(row.result) ||
    !Number.isFinite(Date.parse(row.observed_at)))) throw new Error('evaluation_history_invalid');
  const groups = new Map();
  for (const { result, observed_at: observedAt } of rows) {
    let group = groups.get(result.revision);
    if (!group) {
      group = { latestAt: observedAt, windows: 0, sampled: result.sampled, eligible: result.eligible, selected: new Map(), paired: new Map() };
      groups.set(result.revision, group);
    }
    if (group.sampled !== result.sampled || group.eligible !== result.eligible) throw new Error('evaluation_history_inconsistent');
    group.windows++;
    for (const row of result.cases) {
      if (!group.selected.has(row.item)) group.selected.set(row.item, row);
      if (row.paired && !group.paired.has(row.item)) group.paired.set(row.item, row);
    }
    if (group.selected.size > group.eligible) throw new Error('evaluation_history_inconsistent');
  }
  return { version: 'evaluation_history_summary.v2', retentionDays: 30, windowLimit: 500,
    windows: rows.length, revisions: groups.size,
    groups: [...groups.values()].slice(0, 6).map(group => {
      const cases = [...group.paired.values()], total = key => cases.filter(row => row[key]).length;
      return { latestAt: group.latestAt, windows: group.windows, sampled: group.sampled, eligible: group.eligible,
        selected: group.selected.size, paired: cases.length, labeled: total('labeled'),
        gaps: summarizeEvaluationGaps(group.selected, group.paired),
        gains: total('gain'), regressions: total('regression'), deferralsReduced: total('deferralReduced'), deferralsIncreased: total('deferralIncreased'),
        moviePaired: cases.filter(row => row.mediaType === 'movie').length, tvPaired: cases.filter(row => row.mediaType === 'tv').length };
    }), providerCalls: 0, routingWrites: 0, promotionAllowed: false, fullPipelineAccuracy: null };
}
