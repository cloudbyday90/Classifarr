/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const RESTART_REASONS = Object.freeze(['inventory_changed', 'observation_clocks_changed',
    'sampling_gap', 'configuration_changed', 'expired', 'clock_anomaly']);
const minutes = (later, earlier) => Math.round((Date.parse(later) - Date.parse(earlier)) / 6000) / 10;
const iso = value => new Date(value).toISOString();

function summarize(libraryId, visits) {
    const incremental = visits.filter(point => point.measurementVersion === 3);
    const result = { libraryId, isActive: visits.at(-1).isActive === true,
        legacyVisitCount: visits.length - incremental.length, visitCount: incremental.length,
        completedScans: 0, partialVisits: 0, discardedVisits: 0,
        restartReasons: Object.fromEntries(RESTART_REASONS.map(reason => [reason, 0])),
        firstVisitAt: incremental.length ? iso(incremental[0].observedAt) : null,
        lastVisitAt: incremental.length ? iso(incremental.at(-1).observedAt) : null,
        lastCompletedAt: null, lastMeasurementAt: null, lastCompletedDurationMinutes: null,
        unresolvedSince: null, restartsSinceCompletion: 0, discardedSinceCompletion: 0,
        expirationsSinceCompletion: 0 };
    for (const point of incremental) {
        const restarted = RESTART_REASONS.includes(point.restartReason);
        if (restarted) result.restartReasons[point.restartReason]++;
        if (point.status === 'available') {
            result.completedScans++;
            result.lastCompletedAt = iso(point.observedAt);
            result.lastMeasurementAt = point.scanStartedAt ? iso(point.scanStartedAt) : null;
            result.lastCompletedDurationMinutes = result.lastMeasurementAt
                ? minutes(result.lastCompletedAt, result.lastMeasurementAt) : null;
            result.unresolvedSince = null;
            result.restartsSinceCompletion = 0;
            result.discardedSinceCompletion = 0;
            result.expirationsSinceCompletion = 0;
        } else {
            result.unresolvedSince ??= iso(point.observedAt);
            if (point.status === 'in_progress') result.partialVisits++;
            if (point.status === 'invalidated') {
                result.discardedVisits++;
                result.discardedSinceCompletion++;
            }
            if (restarted) result.restartsSinceCompletion++;
            if (point.restartReason === 'expired') result.expirationsSinceCompletion++;
        }
    }
    return result;
}

function projectCatalog(catalog) {
    if (!catalog) return null;
    return { activeLibraryCount: catalog.activeLibraryCount, withIncrementalVisits: catalog.withIncrementalVisits,
        withCompletedScans: catalog.withCompletedScans, withoutCompletedScans: catalog.withoutCompletedScans,
        withoutIncrementalVisits: catalog.withoutIncrementalVisits,
        unvisitedLibraryIds: catalog.unvisitedLibraryIds.slice(0, 12), unvisitedPreviewLimit: 12,
        unvisitedOmittedCount: catalog.unvisitedOmittedCount };
}

/** Descriptive retained evidence only; a missing completion is not a failed scan. */
export function projectLibraryScanDiagnostics({ points, observedAt, windowStartAt, catalog = null }) {
    if (points.length > 2016) throw new RangeError('Observation history exceeds the retained point limit');
    const end = iso(observedAt);
    // Match the SQL five-minute slot boundary when older internal callers omit it.
    const start = iso(windowStartAt ?? Math.floor(Date.parse(end) / 300000) * 300000 - 10075 * 60000);
    const groups = new Map();
    for (const point of [...points].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))) {
        const time = Date.parse(point.observedAt);
        if (time < Date.parse(start) || time > Date.parse(end)) continue;
        if (!groups.has(point.libraryId)) groups.set(point.libraryId, []);
        groups.get(point.libraryId).push(point);
    }
    const libraries = [...groups].sort(([a], [b]) => a - b).map(([id, visits]) => {
        const item = summarize(id, visits);
        return { ...item, observedSpanMinutes: item.firstVisitAt ? minutes(item.lastVisitAt, item.firstVisitAt) : null,
            lastCompletionAgeMinutes: item.lastCompletedAt ? minutes(end, item.lastCompletedAt) : null,
            unresolvedElapsedMinutes: item.unresolvedSince ? minutes(end, item.unresolvedSince) : null,
            completionEvidence: item.completedScans ? 'retained_completion' : item.visitCount ? 'no_retained_completion' : 'legacy_only',
            repeatedResets: item.restartsSinceCompletion + item.discardedSinceCompletion >= 2 };
    });
    return { version: 'library.scan_diagnostics.v1', windowStartAt: start, windowEndAt: end,
        retainedPointLimit: 2016, catalog: projectCatalog(catalog), libraries };
}
