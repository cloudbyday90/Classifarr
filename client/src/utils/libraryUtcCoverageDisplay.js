/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isProvenanceTrend } from './provenanceTrendDisplay'
import { hasOriginalObservationCounts, reconcileOriginalObservationTypes } from './originalObservationTypeDisplay'

const statuses = ['captured_events', 'unrecorded_events', 'invalid_events', 'unsupported_events']
const exclusions = ['older_events', 'future_events', 'unknown_events']
const fields = ['retained_events', 'events', ...statuses, ...exclusions]
const count = value => Number.isSafeInteger(value) && value >= 0
const validCounts = row => row && fields.every(field => count(row[field]))
  && statuses.reduce((sum, field) => sum + row[field], 0) === row.events
  && row.events + exclusions.reduce((sum, field) => sum + row[field], 0) === row.retained_events
  && row.capture_coverage === (row.events === 0 ? null : row.captured_events / row.events)
  && hasOriginalObservationCounts(row)

export function isLibraryUtcCoverage(coverage, trend, historyEvents) {
  if (!coverage || trend?.time_zone !== 'UTC' || !isProvenanceTrend(trend, 'recorded_instant_utc', exclusions)
    || !['timestamp_basis', 'time_zone', 'day_count', 'start_date', 'end_date'].every(key => coverage[key] === trend[key])
    || !count(historyEvents) || !count(coverage.group_count) || coverage.group_count > historyEvents
    || coverage.group_limit !== 200 || !Array.isArray(coverage.groups)
    || coverage.groups.length !== Math.min(coverage.group_count, coverage.group_limit)
    || coverage.truncated !== (coverage.group_count > coverage.groups.length) || !validCounts(coverage.totals)) return false
  const expected = { retained_events: historyEvents, ...trend.totals, ...trend.excluded }
  if (!fields.every(field => coverage.totals[field] === expected[field])) return false
  let previous = 0
  if (!coverage.groups.every(row => {
    if (!validCounts(row) || row.retained_events === 0) return false
    const id = row.library_id
    const order = id === null ? Infinity : id
    if ((id !== null && (!Number.isInteger(id) || id < 1 || id > 2147483647)) || order <= previous
      || (row.library_name !== null && (typeof row.library_name !== 'string' || [...row.library_name].length > 255))
      || ![true, false, null].includes(row.library_active)
      || (id === null && (row.library_name !== null || row.library_active !== null))) return false
    previous = order
    return true
  })) return false
  const omittedEvents = coverage.totals.retained_events - coverage.groups.reduce((sum, row) => sum + row.retained_events, 0)
  return omittedEvents >= coverage.group_count - coverage.groups.length && reconcileOriginalObservationTypes(coverage) && fields.every(field => {
    const sum = coverage.groups.reduce((total, row) => total + row[field], 0)
    return Number.isSafeInteger(sum) && (coverage.truncated ? sum <= coverage.totals[field] : sum === coverage.totals[field])
  })
}
