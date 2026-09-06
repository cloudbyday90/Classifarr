/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const PAGE_REPAIR_LIMITS = Object.freeze({ pageWidth: 20000, pages: 128, libraries: 32,
    journal: 256, maxId: 2147483647, maxAgeMs: 7 * 86400000 });
export const PAGE_REPAIR_FIELDS = Object.freeze(['inventory', 'supported', 'identified', 'captured', 'fresh', 'keywords', 'language']);

/** Only these two owned namespaces can appear in prototype SQL. */
export function pageRepairNamespace(scope) {
    if (scope === 'temporary') return 'pg_temp';
    if (scope === 'disposable') return 'page_repair_lab';
    throw new Error('Unsupported page repair scope');
}

export function pageRepairRange(page) {
    if (!Number.isInteger(page) || page < 0 || page > Math.floor((PAGE_REPAIR_LIMITS.maxId - 1) / PAGE_REPAIR_LIMITS.pageWidth)) {
        throw new Error('Invalid page repair range');
    }
    return [page * PAGE_REPAIR_LIMITS.pageWidth + 1,
        Math.min((page + 1) * PAGE_REPAIR_LIMITS.pageWidth, PAGE_REPAIR_LIMITS.maxId)];
}

/** Counters remain bigint strings at the database boundary, including above 2^53. */
export function journalContinuity(state, head, events) {
    if (state.generation !== head.generation) return head.reason || 'generation_changed';
    const after = BigInt(state.acknowledged_sequence), through = BigInt(head.sequence);
    if (through < after) return 'missing_continuity';
    if (through - after > BigInt(PAGE_REPAIR_LIMITS.journal)) return 'journal_overflow';
    let expected = after;
    for (const event of events) {
        expected++;
        if (BigInt(event.sequence) !== expected || expected > through) return 'missing_continuity';
    }
    return expected === through ? null : 'missing_continuity';
}
