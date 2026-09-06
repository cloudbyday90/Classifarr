/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const reasons = Object.freeze({
  first_sample: 'First retained sample; no comparison yet.',
  previous_unavailable: 'Previous per-library coverage unavailable.',
  newly_selected: 'Newly selected library; no previous comparison.',
  sample_gap: 'Gap between hourly samples; comparison withheld.',
  sampling_gap: 'Sampling slots were missed; comparison withheld.',
  capacity_exceeded: 'Library inventory limit exceeded; comparison withheld.',
  population_changed: 'Inventory population changed; comparison withheld.',
  configuration_changed: 'Acquisition configuration changed; comparison withheld.',
})
const signed = count => count > 0 ? `+${count}` : String(count)

export function observationTrendChange(row) {
  if (!row) return 'Per-library coverage unavailable.'
  if (row.comparison !== 'comparable' || !row.delta) return reasons[row.comparison] || 'Comparison unavailable.'
  return `Row changes: captured ${signed(row.delta.capturedRows)}, fresh ${signed(row.delta.freshRows)}, keywords ${signed(row.delta.keywordRows)}, language ${signed(row.delta.languageRows)}.`
}

export function observationTrendUnchanged(row) {
  if (row?.unchangedComparisons > 0) return `Capture and known traits unchanged across ${row.unchangedComparisons} sampled comparison${row.unchangedComparisons === 1 ? '' : 's'}.`
  const count = row?.unchangedIntervals
  return count > 0 ? `Capture and known traits unchanged across ${count} hourly interval${count === 1 ? '' : 's'}.` : ''
}
