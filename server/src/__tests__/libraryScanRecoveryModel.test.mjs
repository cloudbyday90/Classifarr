/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildRecoveryModelReport, modelLibraryScanRecovery } from '../scripts/libraryScanRecovery/model.mjs';

const model = (rows, strategy, churn = 'every_turn') => modelLibraryScanRecovery({ rows, strategy, churn });
test('continuous changes starve the current multi-page scan but capped burst completes a two-page population', () => {
    expect(model(20001, 'current')).toMatchObject({ completedScans: 0, firstCompletionMinutes: null, restarts: 5, currentVisitBudgetPreserved: true });
    expect(model(20001, 'two_page_visit')).toMatchObject({ completedScans: 6, firstCompletionMinutes: 0,
        maximumMetadataRowsPerTurn: 20001, currentVisitBudgetPreserved: false, maximumStoredRows: 0 });
});
test('larger continuously changing populations exceed both recovery candidates instead of reporting complete coverage', () => {
    expect(model(40001, 'two_page_visit')).toMatchObject({ completedScans: 0, restarts: 5,
        maximumMetadataRowsPerTurn: 40000, maximumInventoryRowsPerTurn: 40001 });
    expect(model(40001, 'frozen_projection')).toMatchObject({ completedScans: 0, projectionRefusals: 6,
        maximumMetadataRowsPerTurn: 0, maximumStoredRows: 0 });
});
test('stable and periodic populations complete normally and frozen projections preserve their baseline across changes', () => {
    expect(model(20001, 'current', 'stable')).toMatchObject({ firstCompletionMinutes: 75, completedScans: 3, restarts: 0 });
    expect(model(20001, 'current', 'every_two_rounds')).toMatchObject({ firstCompletionMinutes: 75, completedScans: 3, restarts: 0 });
    expect(model(20001, 'frozen_projection')).toMatchObject({ firstCompletionMinutes: 75,
        firstCompletionMeasurementAgeMinutes: 75, completedScans: 3, restarts: 0, maximumStoredRows: 20001 });
});
test('exact page/capture boundaries and empty source work on later frozen visits remain explicit', () => {
    expect(model(20000, 'current')).toMatchObject({ firstCompletionMinutes: 0, completedScans: 6 });
    expect(model(40000, 'two_page_visit')).toMatchObject({ firstCompletionMinutes: 0, completedScans: 6 });
    expect(model(40000, 'frozen_projection')).toMatchObject({ firstCompletionMinutes: 75,
        totalInventoryRows: 120000, maximumStoredRows: 40000 });
    expect(model(80001, 'current', 'stable')).toMatchObject({ firstCompletionMinutes: 300, completedScans: 1 });
});
test('all strategies preserve scheduled other-library slots without claiming database contention was measured', () => {
    const report = buildRecoveryModelReport();
    expect(report.scenarios).toHaveLength(45);
    expect(report.scenarios.every(item => item.otherLibraryVisits === 84 && item.maximumOtherLibraryGapMinutes === 75)).toBe(true);
    expect(report.candidates.every(item => item.productionPromotion === false)).toBe(true);
    expect(report.candidates[0].blockers).toContain('exceeds_current_visit_budget');
    expect(report.candidates[1].blockers).toContain('requires_durable_storage_retention_and_global_capacity_design');
    expect(report).toEqual(buildRecoveryModelReport());
});
test.each([0, -1, 80002, 1.5, '20001', NaN])('rejects unsupported population input: %s', rows => {
    expect(() => model(rows, 'current')).toThrow('Unsupported');
});
test('rejects unknown strategies and churn instead of silently choosing a policy', () => {
    expect(() => model(1, 'unbounded')).toThrow('Unsupported');
    expect(() => model(1, 'current', 'PRIVATE')).toThrow('Unsupported');
});
