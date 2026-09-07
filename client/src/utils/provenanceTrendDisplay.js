/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const fields = ['events', 'captured_events', 'unrecorded_events', 'invalid_events', 'unsupported_events']
const count = value => Number.isSafeInteger(value) && value >= 0
const dateValue = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? new Date(`${value}T00:00:00Z`) : new Date(NaN)
const canonicalDate = value => {
  const date = dateValue(value)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function isProvenanceTrend(trend, basis, exclusionFields) {
  if (trend?.timestamp_basis !== basis || typeof trend.time_zone !== 'string' || !trend.time_zone
    || trend.day_count !== 14 || !Array.isArray(trend.days) || trend.days.length !== 14
    || !canonicalDate(trend.start_date) || !canonicalDate(trend.end_date)
    || !trend.excluded || !exclusionFields.every(field => count(trend.excluded[field]))) return false
  if (![trend.totals, ...trend.days].every(row => row && fields.every(field => count(row[field]))
    && fields.slice(1).reduce((sum, field) => sum + row[field], 0) === row.events
    && row.capture_coverage === (row.events === 0 ? null : row.captured_events / row.events))) return false
  const first = dateValue(trend.start_date)
  return trend.days.every((day, index) => {
    const expected = new Date(first)
    expected.setUTCDate(first.getUTCDate() + index)
    return day.date === expected.toISOString().slice(0, 10) && day.is_partial === (index === 13)
  }) && trend.days.at(-1).date === trend.end_date
    && fields.every(field => trend.days.reduce((sum, day) => sum + day[field], 0) === trend.totals[field])
}

const formatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
// Format an already validated date-only value without moving it into the browser's zone.
export const provenanceDateLabel = value => formatter.format(dateValue(value))
export const provenancePercent = value => value == null ? 'N/A' : `${(value * 100).toFixed(1)}%`
