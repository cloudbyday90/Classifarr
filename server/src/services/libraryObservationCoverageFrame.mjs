/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const LIBRARY_COVERAGE_FIELDS = Object.freeze(['inventoryRows', 'supportedRows', 'identifiedRows',
    'capturedRows', 'freshRows', 'keywordRows', 'languageRows']);

/** Validate the complete frame before comparing; historical missing/malformed detail is unknown. */
export function readLibraryCoverageFrame(sample) {
    const rows = sample?.libraryCoverage;
    if (sample?.status !== 'available' || !Array.isArray(rows) || rows.length > 12
        || rows.length !== sample.libraryIds.length) return null;
    const seen = new Set();
    for (const row of rows) {
        if (!row || !Number.isInteger(row.libraryId) || row.libraryId <= 0 || seen.has(row.libraryId)
            || !sample.libraryIds.includes(row.libraryId) || typeof row.populationFingerprint !== 'string'
            || !/^[a-f0-9]{64}$/.test(row.populationFingerprint)
            || !LIBRARY_COVERAGE_FIELDS.every(field => Number.isInteger(row[field]) && row[field] >= 0)) return null;
        if (row.inventoryRows > 20000 || row.supportedRows > row.inventoryRows || row.identifiedRows > row.supportedRows
            || row.capturedRows > row.identifiedRows || row.freshRows > row.capturedRows
            || row.keywordRows > row.capturedRows || row.languageRows > row.capturedRows) return null;
        seen.add(row.libraryId);
    }
    if (!LIBRARY_COVERAGE_FIELDS.every(field => rows.reduce((sum, row) => sum + row[field], 0) === sample[field])) return null;
    return rows;
}
