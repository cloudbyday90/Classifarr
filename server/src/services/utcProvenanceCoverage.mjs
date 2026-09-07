/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { projectProvenanceTrend } from './provenanceTrendProjection.mjs';

export function buildUtcProvenanceCoverage(trend, retainedTotals, recordingCoverage, captureDate) {
    if (trend?.timestamp_basis !== 'recorded_instant_utc' || trend.time_zone !== 'UTC'
        || trend.end_date !== captureDate) throw new Error('Invalid UTC provenance window');
    const result = projectProvenanceTrend(trend, retainedTotals, ['older_events', 'future_events', 'unknown_events']);
    if (result.excluded.unknown_events !== recordingCoverage.unknown_events
        || result.totals.events + result.excluded.older_events + result.excluded.future_events !== recordingCoverage.recorded_events) {
        throw new Error('Inconsistent UTC recording-time coverage');
    }
    return { ...result, timestamp_basis: 'recorded_instant_utc', time_zone: 'UTC' };
}
