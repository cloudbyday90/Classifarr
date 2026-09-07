/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function dailyProvenanceFixture(counts = { events: 4, captured_events: 1, unrecorded_events: 1, invalid_events: 1, unsupported_events: 1 }, older = 0) {
  const zero = { events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0, capture_coverage: null }
  const totals = { ...counts, capture_coverage: counts.events === 0 ? null : counts.captured_events / counts.events }
  return { day_count: 14, timestamp_basis: 'stored_database_calendar', time_zone: 'America/New_York',
    start_date: '2026-08-25', end_date: '2026-09-07', totals,
    excluded: { older_events: older, future_events: 0, undated_events: 0 },
    days: Array.from({ length: 14 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 7, 25 + index)).toISOString().slice(0, 10), is_partial: index === 13,
      ...(index === 13 ? totals : zero),
    })) }
}

export function utcProvenanceFixture(counts, unknown = 0) {
  return { ...dailyProvenanceFixture(counts), timestamp_basis: 'recorded_instant_utc', time_zone: 'UTC',
    excluded: { older_events: 0, future_events: 0, unknown_events: unknown } }
}
