/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

/** Internal, media-free upgrade manifest derived from the migrated task ledger. */
export function buildPostUpgradeTaskPlan(tasks, completedTaskIds) {
    const completed = new Set(completedTaskIds);
    const entries = tasks.map(({ id, version, action }) => ({
        id,
        version,
        action,
        status: completed.has(id) ? 'recorded' : action === 'clear_logs' ? 'skip_legacy_auto_clear' : 'pending'
    }));
    return {
        schemaVersion: 1,
        total: entries.length,
        pending: entries.filter(entry => entry.status === 'pending').length,
        legacyClearPending: entries.filter(entry => entry.status === 'skip_legacy_auto_clear').length,
        entries
    };
}
