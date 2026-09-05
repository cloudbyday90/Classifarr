/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { projectLibraryCoverageHistory } from '../services/libraryObservationCoverageTrends.mjs';

const coverage = (extra = {}) => ({ libraryId: 1, populationFingerprint: 'a'.repeat(64),
    inventoryRows: 5, supportedRows: 5, identifiedRows: 4, capturedRows: 2, freshRows: 1, keywordRows: 1, languageRows: 0, ...extra });
function sample(hour, extra = {}, row = coverage()) {
    const { libraryId: _id, populationFingerprint: _fingerprint, ...counts } = row;
    return { observedAt: `2026-09-05T${hour}:05:00Z`, status: 'available', libraryIds: [row.libraryId],
        acquisitionConfigured: true, ...counts, libraryCoverage: [row], ...extra };
}
const latest = (...samples) => projectLibraryCoverageHistory(samples)[0];

test('only compares adjacent hours on the same population and projects signed count changes', () => {
    const result = latest(sample('12', {}, coverage({ capturedRows: 3, freshRows: 0, languageRows: 2 })), sample('11'));
    expect(result.libraryCoverage[0]).toMatchObject({ comparison: 'comparable', populationChanged: false,
        delta: { capturedRows: 1, freshRows: -1, keywordRows: 0, languageRows: 2 }, unchangedIntervals: 0 });
    expect(result.selectionChanged).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/populationFingerprint|aaaa/);
});

test('reports equal-count replacements independently of missing-hour markers', () => {
    const changed = sample('12', {}, coverage({ populationFingerprint: 'b'.repeat(64) }));
    expect(latest(changed, sample('11')).libraryCoverage[0]).toMatchObject({ comparison: 'population_changed', populationChanged: true, delta: null });
    expect(latest(changed, sample('10')).libraryCoverage[0]).toMatchObject({ comparison: 'sample_gap', populationChanged: true, delta: null });
});

test('configuration changes and non-consecutive/duplicate hours break comparisons', () => {
    expect(latest(sample('12', { acquisitionConfigured: false }), sample('11')).libraryCoverage[0].comparison).toBe('configuration_changed');
    for (const prior of ['10', '12', '13']) {
        expect(latest(sample('12'), sample(prior)).libraryCoverage[0]).toMatchObject({ comparison: 'sample_gap', delta: null });
    }
});

test('first samples, legacy history, capacity and newly selected libraries retain explicit boundaries', () => {
    expect(latest(sample('12')).libraryCoverage[0]).toMatchObject({ comparison: 'first_sample', populationChanged: null });
    for (const previous of [sample('11', { libraryCoverage: null }), sample('11', { status: 'capacity_exceeded' })]) {
        expect(latest(sample('12'), previous).libraryCoverage[0]).toMatchObject({ comparison: 'previous_unavailable', delta: null });
    }
    const result = latest(sample('12'), sample('11', {}, coverage({ libraryId: 2 })));
    expect(result.selectionChanged).toBe(true);
    expect(result.libraryCoverage[0]).toMatchObject({ comparison: 'newly_selected', delta: null });
    expect(latest(sample('12', { libraryCoverage: null })).libraryCoverage).toBeNull();
});

test('counts unchanged comparable intervals without treating freshness expiry as acquisition loss', () => {
    const result = projectLibraryCoverageHistory([sample('12', {}, coverage({ freshRows: 0 })), sample('11'), sample('10')]);
    expect(result.map(frame => frame.libraryCoverage[0].unchangedIntervals)).toEqual([2, 1, 0]);
    expect(latest(sample('12'), sample('10'), sample('09')).libraryCoverage[0].unchangedIntervals).toBe(0);
});

test.each([
    null, {}, [], [null], [coverage({ libraryId: 2 })], [coverage(), coverage()],
    [coverage({ populationFingerprint: 'invalid' })], [coverage({ capturedRows: 6 })],
    [coverage({ keywordRows: -1 })], [coverage({ freshRows: 0.5 })],
    [coverage({ languageRows: 3 })], [coverage({ supportedRows: 6 })],
    [coverage({ identifiedRows: 6 })], [coverage({ inventoryRows: 20001 })],
    [coverage({ keywordRows: 2 })], Array(13).fill(coverage()),
])('withholds malformed or inconsistent detail: %j', detail => {
    const result = latest(sample('12', { libraryCoverage: detail }), sample('11'));
    expect(result.libraryCoverage).toBeNull();
});

test('allows an empty selected population and never exposes unexpected persisted fields', () => {
    expect(latest(sample('12', { libraryIds: [], libraryCoverage: [], inventoryRows: 0, supportedRows: 0,
        identifiedRows: 0, capturedRows: 0, freshRows: 0, keywordRows: 0, languageRows: 0 })).libraryCoverage).toEqual([]);
    const result = latest(sample('12', {}, coverage({ secret: 'PRIVATE', title: 'PRIVATE' })));
    expect(JSON.stringify(result.libraryCoverage)).not.toMatch(/PRIVATE|secret|title/);
});
