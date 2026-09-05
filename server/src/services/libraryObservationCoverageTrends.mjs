/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { LIBRARY_COVERAGE_FIELDS, readLibraryCoverageFrame } from './libraryObservationCoverageFrame.mjs';

const changeFields = ['capturedRows', 'freshRows', 'keywordRows', 'languageRows'];
const gainFields = ['capturedRows', 'keywordRows', 'languageRows'];
const hour = timestamp => Math.floor(Date.parse(timestamp) / 3600000);

function comparison(sample, previous, row, prior) {
    if (!previous) return 'first_sample';
    if (!prior) return previous.libraryIds.includes(row.libraryId) ? 'previous_unavailable' : 'newly_selected';
    if (hour(sample.observedAt) - hour(previous.observedAt) !== 1) return 'sample_gap';
    if (row.populationFingerprint !== prior.populationFingerprint) return 'population_changed';
    if (sample.acquisitionConfigured !== previous.acquisitionConfigured) return 'configuration_changed';
    return 'comparable';
}

/** Newest-first frames in, explicit comparison boundaries out. Fingerprints never leave this service. */
export function projectLibraryCoverageHistory(samples) {
    const projected = [];
    let previous = null;
    let priorRows = null;
    let previousOutput = null;
    for (const sample of [...samples].reverse()) {
        const rows = readLibraryCoverageFrame(sample);
        const libraryCoverage = rows?.map(row => {
            const prior = priorRows?.find(item => item.libraryId === row.libraryId);
            const status = comparison(sample, previous, row, prior);
            const delta = status === 'comparable'
                ? Object.fromEntries(changeFields.map(field => [field, row[field] - prior[field]])) : null;
            const unchanged = delta && gainFields.every(field => delta[field] === 0);
            const priorOutput = previousOutput?.libraryCoverage?.find(item => item.libraryId === row.libraryId);
            return { libraryId: row.libraryId, ...Object.fromEntries(LIBRARY_COVERAGE_FIELDS.map(field => [field, row[field]])),
                comparison: status, previousObservedAt: previous?.observedAt ?? null,
                populationChanged: prior ? row.populationFingerprint !== prior.populationFingerprint : null,
                delta, unchangedIntervals: unchanged ? (priorOutput?.unchangedIntervals ?? 0) + 1 : 0 };
        }) ?? null;
        const output = { ...sample, libraryCoverage,
            selectionChanged: previous ? sample.libraryIds.length !== previous.libraryIds.length
                || sample.libraryIds.some(id => !previous.libraryIds.includes(id)) : null };
        projected.push(output);
        previous = sample;
        priorRows = rows;
        previousOutput = output;
    }
    return projected.reverse();
}
