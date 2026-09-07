/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const zero = () => ({ events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 });
export function emptyProvenanceTrend() {
    return { day_count: 14, timestamp_basis: 'stored_database_calendar', time_zone: 'America/New_York',
        start_date: '2026-08-25', end_date: '2026-09-07', totals: zero(),
        excluded: { older_events: 0, future_events: 0, undated_events: 0 },
        days: Array.from({ length: 14 }, (_, index) => ({
            date: new Date(Date.UTC(2026, 7, 25 + index)).toISOString().slice(0, 10),
            is_partial: index === 13, ...zero(),
        })) };
}

export function emptyUtcProvenanceTrend() {
    return { ...emptyProvenanceTrend(), timestamp_basis: 'recorded_instant_utc', time_zone: 'UTC',
        excluded: { older_events: 0, future_events: 0, unknown_events: 0 } };
}
