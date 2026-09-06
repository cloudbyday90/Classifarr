/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { LIBRARY_COVERAGE_FIELDS } from './libraryObservationCoverageFrame.mjs';

const deltaFields = ['capturedRows', 'freshRows', 'keywordRows', 'languageRows'];
function compare(point, prior) {
    if (point.status !== 'available') return 'capacity_exceeded';
    if (!prior) return 'first_sample';
    if (prior.status !== 'available') return 'previous_unavailable';
    if (point.continuitySince !== prior.continuitySince) return 'sampling_gap';
    if (point.populationFingerprint !== prior.populationFingerprint) return 'population_changed';
    if (point.acquisitionConfigured !== prior.acquisitionConfigured) return 'configuration_changed';
    return 'comparable';
}

/** Compare visits by library, never by adjacent global points or an assumed hourly cadence. */
export function projectLibraryObservationPoints(points) {
    const previous = new Map();
    const result = [];
    for (const point of [...points].reverse()) {
        const prior = previous.get(point.libraryId);
        const comparison = compare(point, prior?.raw);
        const delta = comparison === 'comparable'
            ? Object.fromEntries(deltaFields.map(field => [field, point[field] - prior.raw[field]])) : null;
        const unchanged = delta && ['capturedRows', 'keywordRows', 'languageRows'].every(field => delta[field] === 0);
        const output = { libraryId: point.libraryId, observedAt: new Date(point.observedAt).toISOString(),
            status: point.status, acquisitionConfigured: point.acquisitionConfigured, inventoryLowerBound: point.inventoryLowerBound,
            ...Object.fromEntries(LIBRARY_COVERAGE_FIELDS.map(field => [field, point[field]])), comparison,
            previousObservedAt: prior?.output.observedAt ?? null,
            elapsedMinutes: prior ? Math.round((Date.parse(point.observedAt) - Date.parse(prior.raw.observedAt)) / 6000) / 10 : null,
            populationChanged: point.populationFingerprint && prior?.raw.populationFingerprint
                ? point.populationFingerprint !== prior.raw.populationFingerprint : null,
            delta, unchangedComparisons: unchanged ? prior.output.unchangedComparisons + 1 : 0 };
        result.push(output);
        previous.set(point.libraryId, { raw: point, output });
    }
    return result.reverse();
}
