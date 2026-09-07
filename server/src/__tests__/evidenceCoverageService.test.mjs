/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { buildEvidenceCoverage, readEvidenceCoverage } from '../services/evidenceCoverageService.mjs';
import { readEvidenceCoverageSnapshot, EVIDENCE_COVERAGE_SQL } from '../services/evidenceCoverageQuery.mjs';

const empty = () => ({ captured_at: new Date('2026-09-07T00:00:00Z'),
    history_totals: { events: 0, imported_observations: 0, original_candidates: 0, linked_feedback: 0 },
    history_group_count: '0', history_groups: [],
    feedback_totals: { observations: 0, source_bound: 0, evaluated: 0, unevaluated: 0 },
    feedback_group_count: '0', feedback_groups: [], deleted_feedback_receipts: '0' });

test('empty observations are known zero while feedback coverage is unavailable', () => {
    const result = buildEvidenceCoverage(empty());
    expect(result.status).toBe('available');
    expect(result.history.totals.events).toBe(0);
    expect(result.feedback.totals.evaluation_coverage).toBeNull();
});

test.each([null, -1, 1.5, 'no', '9007199254740992', false])('invalid count %s cannot become plausible coverage', invalid => {
    const snapshot = empty();
    snapshot.history_totals.events = invalid;
    expect(() => buildEvidenceCoverage(snapshot)).toThrow('Invalid evidence count');
});

test.each(['timestamp', 'subcount', 'partition', 'missing_groups'])('rejects inconsistent %s', kind => {
    const snapshot = empty();
    if (kind === 'timestamp') snapshot.captured_at = 'invalid';
    if (kind === 'subcount') snapshot.history_totals.imported_observations = 1;
    if (kind === 'partition') snapshot.feedback_totals.observations = 2;
    if (kind === 'missing_groups') snapshot.history_group_count = 1;
    expect(() => buildEvidenceCoverage(snapshot)).toThrow();
});

test('uses one bounded read in a read-only transaction', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [empty()] });
    const db = { withTransaction: jest.fn(callback => callback({ query })) };
    expect(await readEvidenceCoverageSnapshot(db)).toEqual(empty());
    expect(query.mock.calls).toEqual([
        ['SET TRANSACTION READ ONLY'], ["SET LOCAL statement_timeout = '5s'"], [EVIDENCE_COVERAGE_SQL, [200]],
    ]);
    expect((await readEvidenceCoverage(db)).status).toBe('available');
});

test('read failure is explicitly unavailable and never leaks database details', async () => {
    const db = { withTransaction: jest.fn().mockRejectedValue(new Error('PRIVATE database metadata')) };
    const result = await readEvidenceCoverage(db);
    expect(result).toMatchObject({ status: 'unavailable', captured_at: null, history: null, feedback: null });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
