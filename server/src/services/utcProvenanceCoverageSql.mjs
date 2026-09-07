/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { PROVENANCE_STATUSES, PROVENANCE_COUNT_FIELDS, PROVENANCE_TREND_DAYS } from './evidenceProvenanceProjection.mjs';
import { ORIGINAL_OBSERVATION_TYPE_SQL } from './originalObservationTypeSql.mjs';
import { CANDIDATE_LIBRARY_COMPARISON_SQL } from './candidateLibraryComparisonSql.mjs';

// Every instant/date conversion names UTC; the session TimeZone never supplies an offset.
export const UTC_PROVENANCE_CTES_SQL = `utc_trend_clock AS (
    SELECT statement_timestamp() AS cutoff,
        (statement_timestamp() AT TIME ZONE 'UTC')::date AS end_date,
        (statement_timestamp() AT TIME ZONE 'UTC')::date - ${PROVENANCE_TREND_DAYS - 1} AS start_date
), utc_trend_population AS MATERIALIZED (
    SELECT history.library_id, ${ORIGINAL_OBSERVATION_TYPE_SQL} AS observation_type,
        ${CANDIDATE_LIBRARY_COMPARISON_SQL} AS candidate_comparison_state,
        (history.recorded_at AT TIME ZONE 'UTC')::date AS day, history.provenance_status, CASE
        WHEN history.recorded_at IS NULL OR NOT isfinite(history.recorded_at) THEN 'unknown'
        WHEN history.recorded_at < (clock.start_date::timestamp AT TIME ZONE 'UTC') THEN 'older'
        WHEN history.recorded_at >= clock.cutoff THEN 'future'
        ELSE 'window' END AS time_scope
    FROM history_evidence history CROSS JOIN utc_trend_clock clock
), utc_trend_daily_counts AS (
    SELECT day, count(*) AS events,
        ${PROVENANCE_STATUSES.map(status => `count(*) FILTER (WHERE provenance_status = '${status}') AS ${status}_events`).join(',\n        ')}
    FROM utc_trend_population WHERE time_scope = 'window' GROUP BY day
), utc_trend_days AS MATERIALIZED (
    SELECT to_char(clock.start_date + series.day_index, 'YYYY-MM-DD') AS date,
        series.day_index = ${PROVENANCE_TREND_DAYS - 1} AS is_partial,
        ${PROVENANCE_COUNT_FIELDS.map(field => `COALESCE(counts.${field}, 0) AS ${field}`).join(',\n        ')}
    FROM utc_trend_clock clock CROSS JOIN generate_series(0, ${PROVENANCE_TREND_DAYS - 1}) AS series(day_index)
    LEFT JOIN utc_trend_daily_counts counts ON counts.day = clock.start_date + series.day_index
)`;

export const UTC_PROVENANCE_SELECT_SQL = `(SELECT jsonb_build_object(
    'day_count', ${PROVENANCE_TREND_DAYS}, 'timestamp_basis', 'recorded_instant_utc', 'time_zone', 'UTC',
    'start_date', to_char(clock.start_date, 'YYYY-MM-DD'), 'end_date', to_char(clock.end_date, 'YYYY-MM-DD'),
    'totals', (SELECT jsonb_build_object(${PROVENANCE_COUNT_FIELDS.map(field => `'${field}', COALESCE(sum(${field}), 0)`).join(', ')}) FROM utc_trend_days),
    'excluded', (SELECT jsonb_build_object(
        'older_events', count(*) FILTER (WHERE time_scope = 'older'),
        'future_events', count(*) FILTER (WHERE time_scope = 'future'),
        'unknown_events', count(*) FILTER (WHERE time_scope = 'unknown')) FROM utc_trend_population),
    'days', (SELECT jsonb_agg(to_jsonb(day) ORDER BY day.date) FROM utc_trend_days day))
    FROM utc_trend_clock clock) AS utc_provenance_trend,`;
