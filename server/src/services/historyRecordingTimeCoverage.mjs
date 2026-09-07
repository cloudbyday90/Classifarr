/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { evidenceCounts } from './evidenceCoverageProjection.mjs';

export function buildHistoryRecordingTimeCoverage(raw, historyEvents) {
    const counts = evidenceCounts(raw, ['events', 'recorded_events', 'unknown_events']);
    if (counts.events !== historyEvents || counts.recorded_events + counts.unknown_events !== counts.events) {
        throw new Error('Inconsistent history recording time counts');
    }
    return counts;
}
