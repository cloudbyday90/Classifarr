/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export function evidenceCount(value) {
    const number = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)) ? Number(value) : NaN;
    if (!Number.isSafeInteger(number) || number < 0) throw new Error('Invalid evidence count');
    return number;
}

export function evidenceCounts(row, fields) {
    return Object.fromEntries(fields.map(field => [field, evidenceCount(row[field])]));
}

export function reconcileEvidenceGroups(totals, groups, fields, truncated) {
    for (const field of fields) {
        const shown = groups.reduce((sum, row) => sum + row[field], 0);
        if (!Number.isSafeInteger(shown) || shown > totals[field] || (!truncated && shown !== totals[field])) {
            throw new Error('Inconsistent evidence group totals');
        }
    }
}
