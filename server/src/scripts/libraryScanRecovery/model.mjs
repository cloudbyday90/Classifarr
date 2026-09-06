/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const RECOVERY_BENCHMARK_LIMITS = Object.freeze({ pageRows: 20000, burstPages: 2,
    frozenRows: 40000, libraryCount: 15, intervalMinutes: 5, slots: 90 });
export const RECOVERY_STRATEGIES = Object.freeze(['current', 'two_page_visit', 'frozen_projection']);
const CHURN = Object.freeze(['stable', 'every_two_rounds', 'every_turn']);

/** Scheduled slots are modeled, not wall-clock latency or production churn. */
export function modelLibraryScanRecovery({ rows, strategy, churn }) {
    if (!Number.isInteger(rows) || rows < 1 || rows > 80001 || !RECOVERY_STRATEGIES.includes(strategy) || !CHURN.includes(churn)) {
        throw new RangeError('Unsupported recovery benchmark scenario');
    }
    const limits = RECOVERY_BENCHMARK_LIMITS;
    let scanned = 0, scanRevision = null, frozen = false, firstCompletionMinutes = null;
    let restarts = 0, completedScans = 0, maximumInventoryRowsPerTurn = 0, maximumStoredRows = 0;
    let maximumMetadataRowsPerTurn = 0;
    let projectionRefusals = 0, totalInventoryRows = 0;
    let scanStartSlot = 0, firstCompletionMeasurementAgeMinutes = null;
    const visits = Array.from({ length: limits.libraryCount }, () => []);
    for (let slot = 0; slot < limits.slots; slot++) {
        const library = slot % limits.libraryCount;
        visits[library].push(slot * limits.intervalMinutes);
        if (library !== 0) continue;
        const revision = churn === 'stable' ? 0 : churn === 'every_turn' ? slot : Math.floor(slot / (2 * limits.libraryCount));
        if (strategy !== 'frozen_projection' && scanned && scanRevision !== revision) { scanned = 0; restarts++; }
        scanRevision = revision;
        if (!scanned) scanStartSlot = slot;
        let inventoryRead = 0;
        let metadataRead = 0;
        if (strategy === 'frozen_projection') {
            if (!frozen) {
                inventoryRead = Math.min(rows, limits.frozenRows + 1);
                if (rows > limits.frozenRows) projectionRefusals++;
                else { frozen = true; metadataRead = rows; maximumStoredRows = Math.max(maximumStoredRows, rows); }
            }
            if (frozen) scanned += Math.min(limits.pageRows, rows - scanned);
        } else {
            const budget = limits.pageRows * (strategy === 'two_page_visit' ? limits.burstPages : 1);
            // Includes the indexed lookahead ID, which does not require metadata projection.
            inventoryRead = Math.min(rows - scanned, budget + 1);
            metadataRead = Math.min(rows - scanned, budget);
            scanned += Math.min(rows - scanned, budget);
        }
        totalInventoryRows += inventoryRead;
        maximumInventoryRowsPerTurn = Math.max(maximumInventoryRowsPerTurn, inventoryRead);
        maximumMetadataRowsPerTurn = Math.max(maximumMetadataRowsPerTurn, metadataRead);
        if (scanned === rows) {
            completedScans++; firstCompletionMinutes ??= slot * limits.intervalMinutes;
            firstCompletionMeasurementAgeMinutes ??= (slot - scanStartSlot) * limits.intervalMinutes;
            scanned = 0; frozen = false;
        }
    }
    const otherVisits = visits.slice(1);
    const gaps = otherVisits.flatMap(times => times.slice(1).map((time, i) => time - times[i]));
    return { rows, strategy, churn, completedScans, firstCompletionMinutes, firstCompletionMeasurementAgeMinutes, restarts, projectionRefusals,
        maximumInventoryRowsPerTurn, maximumMetadataRowsPerTurn, totalInventoryRows, maximumStoredRows,
        otherLibraryVisits: otherVisits.reduce((n, times) => n + times.length, 0),
        maximumOtherLibraryGapMinutes: Math.max(...gaps),
        currentVisitBudgetPreserved: maximumInventoryRowsPerTurn <= limits.pageRows + 1 && maximumMetadataRowsPerTurn <= limits.pageRows };
}

export function buildRecoveryModelReport() {
    const scenarios = [20000, 20001, 40000, 40001, 80001].flatMap(rows =>
        CHURN.flatMap(churn => RECOVERY_STRATEGIES.map(strategy => modelLibraryScanRecovery({ rows, churn, strategy }))));
    const candidates = RECOVERY_STRATEGIES.filter(strategy => strategy !== 'current').map(strategy => {
        const results = scenarios.filter(result => result.strategy === strategy);
        const blockers = [];
        if (results.some(result => !result.currentVisitBudgetPreserved)) blockers.push('exceeds_current_visit_budget');
        if (results.some(result => result.churn === 'every_turn' && !result.completedScans)) blockers.push('no_completion_for_all_churn_populations');
        if (strategy === 'frozen_projection') blockers.push('requires_durable_storage_retention_and_global_capacity_design');
        return { strategy, productionPromotion: blockers.length === 0, blockers };
    });
    return { version: 'library.scan_recovery_benchmark.v1', evidence: 'deterministic_scheduling_model',
        limits: RECOVERY_BENCHMARK_LIMITS, scenarios, candidates };
}
