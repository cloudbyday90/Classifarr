/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evidenceCounts, reconcileEvidenceGroups } from './evidenceCoverageProjection.mjs';
import { PROVENANCE_COUNT_FIELDS, projectProvenanceCounts } from './evidenceProvenanceProjection.mjs';
import { PROVENANCE_TREND_DAYS } from './dailyProvenanceCoverageSql.mjs';

function calendarDate(value) {
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(NaN);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid provenance date');
    return date;
}
const withCoverage = counts => ({ ...counts, capture_coverage: counts.events === 0 ? null : counts.captured_events / counts.events });

export function buildDailyProvenanceCoverage(trend, retainedTotals) {
    if (!trend || trend.day_count !== PROVENANCE_TREND_DAYS || trend.timestamp_basis !== 'stored_database_calendar'
        || typeof trend.time_zone !== 'string' || !trend.time_zone || trend.time_zone.length > 100
        || !Array.isArray(trend.days) || trend.days.length !== PROVENANCE_TREND_DAYS) throw new Error('Invalid provenance window');
    const first = calendarDate(trend.start_date);
    calendarDate(trend.end_date);
    const totals = projectProvenanceCounts(trend.totals);
    const excluded = evidenceCounts(trend.excluded, ['older_events', 'future_events', 'undated_events']);
    const events = totals.events + Object.values(excluded).reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(events) || events !== retainedTotals.events
        || PROVENANCE_COUNT_FIELDS.some(field => totals[field] > retainedTotals[field])) throw new Error('Inconsistent provenance window totals');
    const days = trend.days.map((day, index) => {
        const expected = new Date(first);
        expected.setUTCDate(first.getUTCDate() + index);
        if (day.date !== expected.toISOString().slice(0, 10) || day.is_partial !== (index === PROVENANCE_TREND_DAYS - 1)) {
            throw new Error('Incomplete provenance dates');
        }
        return { date: day.date, is_partial: day.is_partial, ...withCoverage(projectProvenanceCounts(day)) };
    });
    if (days.at(-1).date !== trend.end_date) throw new Error('Invalid provenance window end');
    reconcileEvidenceGroups(totals, days, PROVENANCE_COUNT_FIELDS, false);
    return { day_count: PROVENANCE_TREND_DAYS, timestamp_basis: trend.timestamp_basis, time_zone: trend.time_zone,
        start_date: trend.start_date, end_date: trend.end_date, totals: withCoverage(totals), excluded, days };
}
