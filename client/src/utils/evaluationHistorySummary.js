/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const counts = ['windows', 'sampled', 'eligible', 'selected', 'paired', 'labeled', 'gains', 'regressions',
  'deferralsReduced', 'deferralsIncreased', 'moviePaired', 'tvPaired']
const count = (value, max) => Number.isInteger(value) && value >= 0 && value <= max

export function normalizeEvaluationHistory(value) {
  if (value?.version !== 'evaluation_history_summary.v1' || value.retentionDays !== 30 || value.windowLimit !== 500 ||
    value.providerCalls !== 0 || value.routingWrites !== 0 || value.promotionAllowed !== false || value.fullPipelineAccuracy !== null ||
    !count(value.windows, 500) || !count(value.revisions, value.windows) || !Array.isArray(value.groups) ||
    value.groups.length !== Math.min(6, value.revisions) || (value.windows > 0 && value.revisions === 0)) return null
  if (!value.groups.every(row => row && Number.isFinite(Date.parse(row.latestAt)) &&
    counts.every(key => count(row[key], key === 'windows' ? 500 : 300)) && row.windows > 0 &&
    row.eligible <= row.sampled && row.selected <= row.eligible && row.paired <= row.selected && row.labeled <= row.paired &&
    row.gains + row.regressions <= row.labeled && row.deferralsReduced + row.deferralsIncreased <= row.paired &&
    row.moviePaired + row.tvPaired === row.paired)) return null
  // Explicit projection prevents unexpected private server fields entering view state.
  return { windows: value.windows, revisions: value.revisions, groups: value.groups.map(row =>
    Object.fromEntries(['latestAt', ...counts].map(key => [key, row[key]]))) }
}
