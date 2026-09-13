/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const COUNTERS = ['agrees', 'disagrees', 'known_item', 'known_description', 'scope_changed', 'representation_changed',
  'sparse_profiles', 'unstable_profiles', 'ambiguous_profiles', 'invalid_input', 'missing_query', 'duplicate', 'expired', 'capacity', 'invalidated_batches']
const LATENCY = ['under_1ms', 'under_10ms', 'at_least_10ms']

export function normalizeRepresentativeShadowSummary(value) {
  if (value?.version !== 'inventory_representative_shadow_v1' || value.status !== 'available' || value.routingAffected !== false ||
      Object.keys(value).some(key => !['version', 'status', 'routingAffected', 'pending', 'counts', 'latency'].includes(key)) ||
      !Number.isInteger(value.pending) || value.pending < 0 || value.pending > 32) return null
  for (const [fields, source] of [[COUNTERS, value.counts], [LATENCY, value.latency]]) {
    if (!source || Object.keys(source).length !== fields.length || fields.some(key =>
      !Number.isInteger(source[key]) || source[key] < 0 || source[key] > 1000000)) return null
  }
  return { compared: value.counts.agrees + value.counts.disagrees, differs: value.counts.disagrees,
    pending: value.pending, skipped: COUNTERS.filter(key => !['agrees', 'disagrees', 'invalidated_batches'].includes(key))
      .reduce((sum, key) => sum + value.counts[key], 0), capped: Object.values(value.counts).includes(1000000) }
}
