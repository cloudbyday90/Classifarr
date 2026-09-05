/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_TMDB_CACHE_DAYS, INVENTORY_TMDB_RETRY_HOURS } from './inventoryTmdbObservation.mjs';
import { measureLibraryObservationRow, OBSERVATION_HEALTH_STATES } from './libraryObservationHealthState.mjs';
import { readLibraryObservationHealthSnapshot, OBSERVATION_HEALTH_LIMITS } from './libraryObservationHealthQuery.mjs';

const percent = (count, total) => total ? Math.round(count * 1000 / total) / 10 : null;
const detailFields = ['captured', 'keywordsKnown', 'languageKnown', 'emptyKeywords', 'unknownLanguage',
    'invalidObservation', 'undatedObservation', 'clockAnomaly', 'attemptWithoutRefresh'];

function summarize(library, items, now) {
    const counts = Object.fromEntries(detailFields.map(field => [field, 0]));
    const states = Object.fromEntries(OBSERVATION_HEALTH_STATES.map(state => [state, 0]));
    const queue = { processing: 0, pending: 0, idle: 0 };
    let supportedRowCount = 0;
    let identifiedRowCount = 0;
    let oldest = null;
    let latest = null;
    for (const item of items) {
        const row = measureLibraryObservationRow(item, now);
        states[row.state]++;
        queue[row.queueState]++;
        if (row.supported) supportedRowCount++;
        if (row.identified) identifiedRowCount++;
        for (const field of detailFields) if (row[field]) counts[field]++;
        if (row.successfulAt !== null) {
            oldest = oldest === null ? row.successfulAt : Math.min(oldest, row.successfulAt);
            latest = latest === null ? row.successfulAt : Math.max(latest, row.successfulAt);
        }
    }
    return { ...library, inventoryRowCount: items.length, supportedRowCount, identifiedRowCount,
        identityCoveragePercent: percent(identifiedRowCount, supportedRowCount),
        keywordCoveragePercent: percent(counts.keywordsKnown, identifiedRowCount),
        languageCoveragePercent: percent(counts.languageKnown, identifiedRowCount),
        counts, states, queue,
        oldestSuccessfulObservationAt: oldest === null ? null : new Date(oldest).toISOString(),
        lastSuccessfulObservationAt: latest === null ? null : new Date(latest).toISOString() };
}

export async function readLibraryObservationHealth(db) {
    const snapshot = await readLibraryObservationHealthSnapshot(db);
    const now = Date.parse(snapshot.observed_at);
    if (!Number.isFinite(now)) throw new Error('Invalid observation snapshot time');
    const exceeded = snapshot.row_count > OBSERVATION_HEALTH_LIMITS.rowLimit;
    const result = { version: 'library.observation_health.v1', observedAt: new Date(now).toISOString(),
        status: exceeded ? 'capacity_exceeded' : 'available', acquisitionConfigured: snapshot.acquisition_configured,
        scope: { population: 'inventory_rows', selectionOrder: 'active_library_id_ascending', ...OBSERVATION_HEALTH_LIMITS,
            activeLibraryCount: snapshot.active_library_count, selectedLibraryCount: snapshot.libraries.length,
            excludedLibraryCount: snapshot.active_library_count - snapshot.libraries.length },
        freshness: { cacheDays: INVENTORY_TMDB_CACHE_DAYS, retryHours: INVENTORY_TMDB_RETRY_HOURS },
        inventoryRowCount: exceeded ? null : snapshot.row_count, inventoryRowCountLowerBound: snapshot.row_count,
        libraries: snapshot.libraries };
    if (exceeded) return result;
    const groups = new Map(snapshot.libraries.map(library => [library.id, []]));
    for (const item of snapshot.items) groups.get(item.library_id).push(item);
    result.libraries = snapshot.libraries.map(library => summarize(library, groups.get(library.id), now));
    return result;
}
