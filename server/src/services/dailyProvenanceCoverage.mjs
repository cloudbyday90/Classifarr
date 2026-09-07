/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectProvenanceTrend } from './provenanceTrendProjection.mjs';

export function buildDailyProvenanceCoverage(trend, retainedTotals) {
    if (trend?.timestamp_basis !== 'stored_database_calendar' || typeof trend.time_zone !== 'string'
        || !trend.time_zone || trend.time_zone.length > 100) throw new Error('Invalid provenance window');
    return { ...projectProvenanceTrend(trend, retainedTotals, ['older_events', 'future_events', 'undated_events']),
        timestamp_basis: trend.timestamp_basis, time_zone: trend.time_zone };
}
