/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const COUNTERS = ['agrees', 'disagrees', 'known_item', 'known_description', 'scope_changed', 'representation_changed',
  'sparse_profiles', 'unconverged_profiles', 'initialization_sensitive', 'no_positive_match', 'tied_destinations',
  'invalid_input', 'missing_query', 'duplicate', 'expired', 'capacity', 'invalidated_batches']
const LATENCY = ['under_1ms', 'under_10ms', 'at_least_10ms']
const DIAGNOSTICS = [
  ['unconverged_profiles', 'Library profiles have not finished fitting'],
  ['sparse_profiles', 'Too few supported examples to compare every destination'],
  ['initialization_sensitive', 'Learned profiles picked different destinations'],
  ['no_positive_match', 'No positive description match in at least one comparison'],
  ['tied_destinations', 'Destinations tied in at least one comparison'],
]

export function normalizeRepresentativeShadowSummary(value) {
  if (value?.version !== 'inventory_representative_shadow_v2' || value.status !== 'available' || value.routingAffected !== false ||
      Object.keys(value).some(key => !['version', 'status', 'routingAffected', 'pending', 'counts', 'latency'].includes(key)) ||
      !Number.isInteger(value.pending) || value.pending < 0 || value.pending > 32) return null
  for (const [fields, source] of [[COUNTERS, value.counts], [LATENCY, value.latency]]) {
    if (!source || Object.keys(source).length !== fields.length || fields.some(key =>
      !Number.isInteger(source[key]) || source[key] < 0 || source[key] > 1000000)) return null
  }
  const compared = value.counts.agrees + value.counts.disagrees
  const reasons = DIAGNOSTICS.map(([key, label]) => ({ key, label, count: value.counts[key] })).filter(reason => reason.count > 0)
  const notCompared = reasons.reduce((sum, reason) => sum + reason.count, 0)
  return { compared, differs: value.counts.disagrees, unseen: compared + notCompared, notCompared, reasons,
    pending: value.pending, skipped: COUNTERS.filter(key => !['agrees', 'disagrees', 'invalidated_batches'].includes(key))
      .reduce((sum, key) => sum + value.counts[key], 0),
    excluded: COUNTERS.filter(key => !['agrees', 'disagrees', 'invalidated_batches', ...DIAGNOSTICS.map(([key]) => key)].includes(key))
      .reduce((sum, key) => sum + value.counts[key], 0), capped: Object.values(value.counts).includes(1000000) }
}
