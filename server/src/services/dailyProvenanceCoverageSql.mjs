/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PROVENANCE_STATUSES, PROVENANCE_COUNT_FIELDS } from './evidenceProvenanceProjection.mjs';
export const PROVENANCE_TREND_DAYS = 14;

// History timestamps have no offsets. Use their stored calendar, with an explicit session-zone label.
export const DAILY_PROVENANCE_CTES_SQL = `trend_clock AS (
    SELECT statement_timestamp()::timestamp AS cutoff,
        statement_timestamp()::date AS end_date,
        statement_timestamp()::date - ${PROVENANCE_TREND_DAYS - 1} AS start_date,
        current_setting('TimeZone') AS time_zone
), trend_population AS MATERIALIZED (
    SELECT history.created_at, history.provenance_status, CASE
        WHEN history.created_at IS NULL OR NOT isfinite(history.created_at) THEN 'undated'
        WHEN history.created_at < clock.start_date THEN 'older'
        WHEN history.created_at >= clock.cutoff THEN 'future'
        ELSE 'window' END AS time_scope
    FROM history_evidence history CROSS JOIN trend_clock clock
), trend_daily_counts AS (
    SELECT created_at::date AS day, count(*) AS events,
        ${PROVENANCE_STATUSES.map(status => `count(*) FILTER (WHERE provenance_status = '${status}') AS ${status}_events`).join(',\n        ')}
    FROM trend_population WHERE time_scope = 'window' GROUP BY created_at::date
), trend_days AS MATERIALIZED (
    SELECT to_char(clock.start_date + series.day_index, 'YYYY-MM-DD') AS date,
        series.day_index = ${PROVENANCE_TREND_DAYS - 1} AS is_partial,
        ${PROVENANCE_COUNT_FIELDS.map(field => `COALESCE(counts.${field}, 0) AS ${field}`).join(',\n        ')}
    FROM trend_clock clock CROSS JOIN generate_series(0, ${PROVENANCE_TREND_DAYS - 1}) AS series(day_index)
    LEFT JOIN trend_daily_counts counts ON counts.day = clock.start_date + series.day_index
)`;

export const DAILY_PROVENANCE_SELECT_SQL = `(SELECT jsonb_build_object(
    'day_count', ${PROVENANCE_TREND_DAYS}, 'timestamp_basis', 'stored_database_calendar', 'time_zone', clock.time_zone,
    'start_date', to_char(clock.start_date, 'YYYY-MM-DD'), 'end_date', to_char(clock.end_date, 'YYYY-MM-DD'),
    'totals', (SELECT jsonb_build_object(${PROVENANCE_COUNT_FIELDS.map(field => `'${field}', COALESCE(sum(${field}), 0)`).join(', ')}) FROM trend_days),
    'excluded', (SELECT jsonb_build_object(
        'older_events', count(*) FILTER (WHERE time_scope = 'older'),
        'future_events', count(*) FILTER (WHERE time_scope = 'future'),
        'undated_events', count(*) FILTER (WHERE time_scope = 'undated')) FROM trend_population),
    'days', (SELECT jsonb_agg(to_jsonb(day) ORDER BY day.date) FROM trend_days day))
    FROM trend_clock clock) AS provenance_trend,`;
