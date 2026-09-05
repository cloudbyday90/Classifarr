/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readLibraryObservationTraits } from './libraryProfileObservation.mjs';

export const OVERLAP_TRAITS = ['rating', 'genres', 'studio', 'keywords', 'language'];
export const overlapPercent = (count, total) => total ? Math.round(count * 1000 / total) / 10 : null;

/** Private identity maps never leave the aggregate service. */
export function buildOverlapCohort(items, mediaType) {
    const rows = items.filter(item => item.media_type === mediaType);
    const identities = new Map();
    let identifiedRowCount = 0;
    for (const item of rows) {
        if (!Number.isInteger(item.tmdb_id) || item.tmdb_id <= 0 || item.tmdb_id > 2147483647) continue;
        identifiedRowCount++;
        if (!identities.has(item.tmdb_id)) identities.set(item.tmdb_id, new Map());
        const record = identities.get(item.tmdb_id);
        for (const [field, values] of Object.entries(readLibraryObservationTraits(item))) {
            if (!values.length) continue;
            const key = JSON.stringify([...values].sort());
            if (!record.has(field)) record.set(field, key);
            else if (record.get(field) !== key) record.set(field, null);
        }
    }
    const traits = OVERLAP_TRAITS.map(field => {
        const counts = new Map();
        let observedIdentityCount = 0;
        let conflictingIdentityCount = 0;
        for (const record of identities.values()) {
            if (record.get(field) === null) conflictingIdentityCount++;
            else if (record.has(field)) {
                observedIdentityCount++;
                for (const value of JSON.parse(record.get(field))) counts.set(value, (counts.get(value) || 0) + 1);
            }
        }
        return { counts, summary: { field, observedIdentityCount, conflictingIdentityCount,
            unknownIdentityCount: identities.size - observedIdentityCount,
            coveragePercent: overlapPercent(observedIdentityCount, identities.size) } };
    });
    return { identities, traits, summary: { mediaType, rowCount: rows.length, identifiedRowCount,
        unidentifiedRowCount: rows.length - identifiedRowCount,
        identityCoveragePercent: overlapPercent(identifiedRowCount, rows.length),
        distinctIdentityCount: identities.size, duplicateRowCount: identifiedRowCount - identities.size,
        traits: traits.map(trait => trait.summary) } };
}
