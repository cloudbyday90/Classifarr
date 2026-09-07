/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isLibraryUtcCoverage } from './libraryUtcCoverageDisplay'

export const candidateComparisonColumns = Object.freeze([
  { key: 'same_library_events', label: 'Same library' },
  { key: 'different_library_events', label: 'Different library' },
  { key: 'no_candidate_events', label: 'No candidate' },
  { key: 'invalid_candidate_events', label: 'Invalid candidate' },
  { key: 'unknown_library_events', label: 'Recorded library unknown' },
])
const fields = candidateComparisonColumns.map(column => column.key)

function validCounts(row, grouped = false) {
  const counts = row.candidate_comparison
  if (!counts || !fields.every(field => Number.isSafeInteger(counts[field]) && counts[field] >= 0)) return false
  const total = fields.reduce((sum, field) => sum + counts[field], 0)
  if (grouped && (row.library_id === null
    ? counts.same_library_events + counts.different_library_events !== 0 : counts.unknown_library_events !== 0)) return false
  return Number.isSafeInteger(total) && total === row.observation_types.classifier_workflow_events
}

export function isCandidateLibraryComparison(coverage, trend, historyEvents) {
  if (!isLibraryUtcCoverage(coverage, trend, historyEvents)
    || !validCounts(coverage.totals) || !coverage.groups.every(row => validCounts(row, true))) return false
  return fields.every(field => {
    const sum = coverage.groups.reduce((total, row) => total + row.candidate_comparison[field], 0)
    return Number.isSafeInteger(sum) && (coverage.truncated
      ? sum <= coverage.totals.candidate_comparison[field] : sum === coverage.totals.candidate_comparison[field])
  })
}
