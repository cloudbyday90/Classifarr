/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { projectLibraryScanDiagnostics } from '../services/libraryObservationDiagnostics.mjs';

const end = '2026-09-06T12:00:00Z';
const point = (minute, overrides = {}) => ({ libraryId: 1, isActive: true, measurementVersion: 3,
    observedAt: `2026-09-06T11:${String(minute).padStart(2, '0')}:00Z`, scanStartedAt: '2026-09-06T11:00:00Z',
    status: 'in_progress', restartReason: null, ...overrides });
const project = points => projectLibraryScanDiagnostics({ points, observedAt: end });

test('distinguishes recorded restarts from discarded visits and orders evidence chronologically', () => {
    const points = [point(10, { restartReason: 'inventory_changed' }), point(20, { restartReason: 'expired' }),
        point(30, { status: 'invalidated', restartReason: 'changed_before_write' })];
    const report = project(points.toReversed());
    expect(report).toEqual(project(points));
    expect(report.libraries[0]).toMatchObject({ visitCount: 3, partialVisits: 2, discardedVisits: 1,
        completedScans: 0, restartsSinceCompletion: 2, discardedSinceCompletion: 1, expirationsSinceCompletion: 1,
        repeatedResets: true, completionEvidence: 'no_retained_completion', observedSpanMinutes: 20,
        unresolvedElapsedMinutes: 50, restartReasons: { inventory_changed: 1, expired: 1 } });
    expect(report.libraries[0].restartReasons).not.toHaveProperty('changed_before_write');
});

test('completion clears unresolved counters even when that visit restarted; total reasons remain', () => {
    const library = project([point(0, { restartReason: 'expired' }), point(5, { restartReason: 'clock_anomaly' }),
        point(10, { status: 'available', restartReason: 'inventory_changed' })]).libraries[0];
    expect(library).toMatchObject({ completedScans: 1, partialVisits: 2, repeatedResets: false,
        restartsSinceCompletion: 0, discardedSinceCompletion: 0, expirationsSinceCompletion: 0, unresolvedSince: null,
        unresolvedElapsedMinutes: null, lastCompletionAgeMinutes: 50, lastCompletedDurationMinutes: 10,
        completionEvidence: 'retained_completion', restartReasons: { expired: 1, clock_anomaly: 1, inventory_changed: 1 } });
});

test('new unresolved visits start after the last completion without implying continuous processing', () => {
    const library = project([point(0, { status: 'available' }), point(20), point(40, {
        status: 'invalidated', restartReason: 'changed_before_write' })]).libraries[0];
    expect(library).toMatchObject({ completedScans: 1, lastCompletedDurationMinutes: 0,
        unresolvedSince: '2026-09-06T11:20:00.000Z', unresolvedElapsedMinutes: 40,
        restartsSinceCompletion: 0, discardedSinceCompletion: 1, repeatedResets: false });
});

test('legacy completions and unknown reasons cannot masquerade as incremental evidence', () => {
    const libraries = project([point(0, { measurementVersion: 2, status: 'available' }),
        point(10, { libraryId: 2, isActive: false, restartReason: 'PRIVATE' })]).libraries;
    expect(libraries[0]).toMatchObject({ legacyVisitCount: 1, visitCount: 0, completedScans: 0,
        firstVisitAt: null, lastVisitAt: null, observedSpanMinutes: null, completionEvidence: 'legacy_only' });
    expect(libraries[1]).toMatchObject({ isActive: false, restartsSinceCompletion: 0 });
    expect(JSON.stringify(libraries)).not.toContain('PRIVATE');
});

test('uses explicit inclusive boundaries, excludes future/expired points and fails closed on over-cap input', () => {
    const report = projectLibraryScanDiagnostics({ points: [point(0), point(10), point(20), point(30)],
        windowStartAt: point(10).observedAt, observedAt: point(20).observedAt });
    expect(report.libraries[0]).toMatchObject({ visitCount: 2, observedSpanMinutes: 10 });
    expect(() => project(Array(2017).fill(point(0)))).toThrow('retained point limit');
    expect(project([])).toMatchObject({ catalog: null, libraries: [], windowStartAt: '2026-08-30T12:05:00.000Z' });
});

test('allowlists catalog and library evidence without forwarding private metadata or internal cursors', () => {
    const report = projectLibraryScanDiagnostics({ observedAt: end,
        points: [point(10, { status: 'available', scanStartedAt: null, populationFingerprint: 'PRIVATE', metadata: 'PRIVATE', after_id: 999 })],
        catalog: { activeLibraryCount: 14, withIncrementalVisits: 1, withCompletedScans: 1, withoutCompletedScans: 13,
            withoutIncrementalVisits: 13, unvisitedLibraryIds: Array.from({ length: 13 }, (_, i) => i + 2),
            unvisitedOmittedCount: 1, name: 'PRIVATE' } });
    expect(report.catalog.unvisitedLibraryIds).toHaveLength(12);
    expect(report.catalog.unvisitedOmittedCount).toBe(1);
    expect(report.libraries[0].lastCompletedDurationMinutes).toBeNull();
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|populationFingerprint|after_id|metadata/);
});

test('retains all supported restart reasons and counts repeated discarded visits without claiming a restart', () => {
    const reasons = ['inventory_changed', 'observation_clocks_changed', 'sampling_gap', 'configuration_changed', 'expired', 'clock_anomaly'];
    const library = project(reasons.map((restartReason, i) => point(i * 5, { restartReason }))).libraries[0];
    expect(library.restartReasons).toEqual(Object.fromEntries(reasons.map(reason => [reason, 1])));
    const discarded = project([point(0, { status: 'invalidated', restartReason: 'changed_before_write' }),
        point(5, { status: 'invalidated', restartReason: 'changed_before_write' })]).libraries[0];
    expect(discarded).toMatchObject({ restartsSinceCompletion: 0, discardedSinceCompletion: 2, repeatedResets: true });
});
