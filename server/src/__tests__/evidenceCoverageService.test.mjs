/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { buildEvidenceCoverage, readEvidenceCoverage } from '../services/evidenceCoverageService.mjs';
import { readEvidenceCoverageSnapshot, EVIDENCE_COVERAGE_SQL } from '../services/evidenceCoverageQuery.mjs';
import { emptyProvenanceTrend, emptyUtcProvenanceTrend } from './helpers/evidenceTrendFixture.mjs';
import { emptyLibraryUtcSnapshot } from './helpers/libraryUtcCoverageFixture.mjs';

const empty = () => ({ ...emptyLibraryUtcSnapshot(), captured_at: new Date('2026-09-07T00:00:00Z'),
    history_totals: { events: 0, completed_events: 0, pending_events: 0, retry_events: 0, other_events: 0,
        imported_observations: 0, original_candidates: 0, linked_feedback: 0,
        candidate_no_proposal: 0, candidate_invalid: 0, candidate_not_applicable: 0, candidate_unrecorded: 0 },
    history_group_count: '0', history_groups: [],
    attribution_totals: { events: 0, captured_events: 0, unrecorded_events: 0, invalid_events: 0, unsupported_events: 0 },
    attribution_group_count: 0, attribution_groups: [],
    provenance_trend: emptyProvenanceTrend(),
    utc_provenance_trend: emptyUtcProvenanceTrend(),
    recording_time_coverage: { events: 0, recorded_events: 0, unknown_events: 0 },
    feedback_totals: { observations: 0, source_bound: 0, evaluated: 0, unevaluated: 0 },
    feedback_group_count: '0', feedback_groups: [], deleted_feedback_receipts: '0' });

test('empty observations are known zero while feedback coverage is unavailable', () => {
    const result = buildEvidenceCoverage(empty());
    expect(result.status).toBe('available');
    expect(result.version).toBe('evidence.coverage.v2');
    expect(result.history.totals.events).toBe(0);
    expect(result.feedback.totals.evaluation_coverage).toBeNull();
});

test.each(['totals', 'group'])('candidate availability and missing reasons reconcile for %s', target => {
    const snapshot = empty();
    Object.assign(snapshot.history_totals, { events: 5, completed_events: 5, original_candidates: 1,
        candidate_no_proposal: 1, candidate_invalid: 1, candidate_not_applicable: 1, candidate_unrecorded: 1 });
    snapshot.history_group_count = 1;
    snapshot.history_groups = [{ ...snapshot.history_totals, method: 'ai_analysis' }];
    addUnrecordedAttribution(snapshot, 5);
    expect(buildEvidenceCoverage(snapshot).history.totals.original_candidates).toBe(1);
    const row = target === 'totals' ? snapshot.history_totals : snapshot.history_groups[0];
    row.candidate_unrecorded = 0;
    expect(() => buildEvidenceCoverage(snapshot)).toThrow('Inconsistent candidate capture counts');
    delete row.candidate_unrecorded;
    expect(() => buildEvidenceCoverage(snapshot)).toThrow('Invalid evidence count');
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

test('projects integer lifecycle counts for totals and individual groups', () => {
    const snapshot = empty();
    Object.assign(snapshot.history_totals, { events: '10', completed_events: '4', pending_events: '3', retry_events: '2', other_events: '1', candidate_unrecorded: '10' });
    snapshot.history_group_count = 1;
    snapshot.history_groups = [{ ...snapshot.history_totals, library_id: null, method: 'unknown_method' }];
    addUnrecordedAttribution(snapshot, 10);
    const result = buildEvidenceCoverage(snapshot);
    expect(result.history.totals).toMatchObject({ events: 10, completed_events: 4, pending_events: 3, retry_events: 2, other_events: 1 });
    expect(result.history.groups[0]).toMatchObject(result.history.totals);
});

test.each(['totals', 'group'])('rejects missing, invalid or unreconciled lifecycle counts in %s', target => {
    for (const invalid of [undefined, null, -1, 0.5, 'bad', false, 1]) {
        const snapshot = empty();
        snapshot.history_group_count = 1;
        snapshot.history_totals.events = 2;
        snapshot.history_totals.completed_events = 2;
        snapshot.history_totals.candidate_unrecorded = 2;
        snapshot.history_groups = [{ ...snapshot.history_totals, method: 'policy_auto' }];
        const row = target === 'totals' ? snapshot.history_totals : snapshot.history_groups[0];
        row.retry_events = invalid;
        expect(() => buildEvidenceCoverage(snapshot)).toThrow();
    }
});

test('invalid lifecycle snapshot fails closed through the public service', async () => {
    const snapshot = empty();
    delete snapshot.history_totals.other_events;
    const db = { withTransaction: callback => callback({ query: jest.fn().mockResolvedValue({ rows: [snapshot] }) }) };
    expect(await readEvidenceCoverage(db)).toMatchObject({ status: 'unavailable', history: null, feedback: null });
});

test('complete groups must reconcile to their retained totals', () => {
    const snapshot = empty();
    Object.assign(snapshot.history_totals, { events: 2, completed_events: 2, candidate_unrecorded: 2 });
    snapshot.history_group_count = 1;
    snapshot.history_groups = [{ ...snapshot.history_totals, events: 1, completed_events: 1, candidate_unrecorded: 1 }];
    expect(() => buildEvidenceCoverage(snapshot)).toThrow('Inconsistent evidence group totals');
});

test('capped groups may omit counts but cannot exceed a global lifecycle total', () => {
    const snapshot = empty();
    snapshot.history_groups = Array.from({ length: 200 }, (_, id) => ({ ...snapshot.history_totals,
        library_id: id + 1, method: 'source_library', events: 1, completed_events: 1, candidate_unrecorded: 1 }));
    snapshot.history_group_count = 201;
    Object.assign(snapshot.history_totals, { events: 201, completed_events: 200, retry_events: 1, candidate_unrecorded: 201 });
    addUnrecordedAttribution(snapshot, 201);
    expect(buildEvidenceCoverage(snapshot).history.truncated).toBe(true);
    Object.assign(snapshot.history_totals, { completed_events: 199, pending_events: 1 });
    expect(() => buildEvidenceCoverage(snapshot)).toThrow('Inconsistent evidence group totals');
});

test('read failure is explicitly unavailable and never leaks database details', async () => {
    const db = { withTransaction: jest.fn().mockRejectedValue(new Error('PRIVATE database metadata')) };
    const result = await readEvidenceCoverage(db);
    expect(result).toMatchObject({ status: 'unavailable', captured_at: null, history: null, feedback: null });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

function addUnrecordedAttribution(snapshot, events) {
    Object.assign(snapshot.utc_library_totals, { retained_events: events, unknown_events: events });
    snapshot.utc_library_group_count = 1;
    snapshot.utc_library_groups = [{ ...snapshot.utc_library_totals, library_id: null, library_name: null, library_active: null }];
    snapshot.utc_provenance_trend.excluded.unknown_events = events;
    snapshot.recording_time_coverage = { events, recorded_events: 0, unknown_events: events };
    snapshot.provenance_trend.excluded.older_events = events;
    Object.assign(snapshot.attribution_totals, { events, unrecorded_events: events });
    snapshot.attribution_group_count = 1;
    snapshot.attribution_groups = [{ original_method: null, candidate_source: null,
        recorded_method: 'unknown_method', provenance_status: 'unrecorded', events }];
}

test('missing attribution fails closed through the public service', async () => {
    const snapshot = empty();
    delete snapshot.attribution_totals;
    const db = { withTransaction: callback => callback({ query: jest.fn().mockResolvedValue({ rows: [snapshot] }) }) };
    expect(await readEvidenceCoverage(db)).toMatchObject({ status: 'unavailable', history_attribution: null });
});

test.each([null, { events: 0, recorded_events: 1, unknown_events: 0 }])('invalid recording-time coverage fails closed', async value => {
    const snapshot = { ...empty(), recording_time_coverage: value };
    const db = { withTransaction: callback => callback({ query: jest.fn().mockResolvedValue({ rows: [snapshot] }) }) };
    expect(await readEvidenceCoverage(db)).toMatchObject({ status: 'unavailable', recording_time_coverage: null });
});

test('missing UTC coverage makes the snapshot unavailable rather than borrowing legacy dates', async () => {
    const snapshot = { ...empty(), utc_provenance_trend: undefined };
    const db = { withTransaction: callback => callback({ query: jest.fn().mockResolvedValue({ rows: [snapshot] }) }) };
    expect(await readEvidenceCoverage(db)).toMatchObject({ status: 'unavailable', utc_provenance_trend: null });
});

test('missing library UTC coverage is unavailable rather than borrowing all-retained library counts', async () => {
    const snapshot = { ...empty(), utc_library_totals: undefined };
    const db = { withTransaction: callback => callback({ query: jest.fn().mockResolvedValue({ rows: [snapshot] }) }) };
    expect(await readEvidenceCoverage(db)).toMatchObject({ status: 'unavailable', utc_library_coverage: null });
});
