/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const observationTypeColumns = Object.freeze([
  { key: 'imported_membership_events', label: 'Imported membership' },
  { key: 'manual_action_events', label: 'Manual action' },
  { key: 'classifier_workflow_events', label: 'Classifier workflow' },
  { key: 'unknown_origin_events', label: 'Unknown origin' },
])
const fields = observationTypeColumns.map(column => column.key)

export function hasOriginalObservationCounts(row) {
  const types = row?.observation_types
  if (!types || !fields.every(field => Number.isSafeInteger(types[field]) && types[field] >= 0)) return false
  const known = types.imported_membership_events + types.manual_action_events + types.classifier_workflow_events
  return Number.isSafeInteger(known) && known <= row.captured_events && known + types.unknown_origin_events === row.events
}

export function reconcileOriginalObservationTypes(coverage) {
  return fields.every(field => {
    const sum = coverage.groups.reduce((total, row) => total + row.observation_types[field], 0)
    return Number.isSafeInteger(sum) && (coverage.truncated
      ? sum <= coverage.totals.observation_types[field] : sum === coverage.totals.observation_types[field])
  })
}
