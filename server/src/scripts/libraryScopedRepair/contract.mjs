/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const SCOPED_REPAIR_LIMITS = Object.freeze({ rows: 20000, pages: 128, libraries: 32,
    mutations: 128, metadataBytes: 65536, maxId: 2147483647, maxAgeMs: 7 * 86400000 });
export const SCOPED_REPAIR_LOCK_NAMESPACE = 0x434c5343;

export function scopedRepairNamespace(scope) {
    if (scope === 'temporary') return 'pg_temp';
    if (scope === 'disposable') return 'scoped_repair_lab';
    throw new Error('Unsupported scoped repair scope');
}

export function requireScopedRepairId(id) {
    if (!Number.isInteger(id) || id < 1 || id > SCOPED_REPAIR_LIMITS.maxId) throw new Error('Invalid scoped repair identifier');
    return id;
}

export function orderedScopedLibraries(ids) {
    if (!Array.isArray(ids) || ids.length > SCOPED_REPAIR_LIMITS.mutations * 2) throw new Error('Invalid scoped repair library set');
    return [...new Set(ids.filter(id => id !== null).map(requireScopedRepairId))].sort((a, b) => a - b);
}
