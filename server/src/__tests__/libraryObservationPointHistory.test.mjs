/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { projectLibraryObservationPoints } from '../services/libraryObservationPointHistory.mjs';
import { captureLibraryObservationSample } from '../services/libraryObservationSample.mjs';

const point = (minute, extra = {}) => ({ libraryId: 1, observedAt: `2026-09-05T12:${minute}:00Z`, status: 'available',
    acquisitionConfigured: true, continuitySince: '2026-09-05T00:00:00Z', populationFingerprint: 'a'.repeat(64),
    inventoryLowerBound: 2, inventoryRows: 2, supportedRows: 2, identifiedRows: 2, capturedRows: 1,
    freshRows: 1, keywordRows: 0, languageRows: 0, ...extra });

test('compares library visits across normal rotation and exposes actual elapsed time', () => {
    const output = projectLibraryObservationPoints([point('20', { keywordRows: 1 }), point('15', { libraryId: 2 }), point('10')]);
    expect(output[0]).toMatchObject({ comparison: 'comparable', elapsedMinutes: 10, populationChanged: false,
        delta: { capturedRows: 0, freshRows: 0, keywordRows: 1, languageRows: 0 }, unchangedComparisons: 0 });
    expect(output[1].comparison).toBe('first_sample');
    expect(JSON.stringify(output)).not.toMatch(/populationFingerprint|continuitySince|aaaa/);
});

test.each([
    [{ status: 'capacity_exceeded', populationFingerprint: null }, {}, 'capacity_exceeded'],
    [{}, { status: 'capacity_exceeded', populationFingerprint: null }, 'previous_unavailable'],
    [{ continuitySince: '2026-09-05T12:20:00Z' }, {}, 'sampling_gap'],
    [{ populationFingerprint: 'b'.repeat(64) }, {}, 'population_changed'],
    [{ acquisitionConfigured: false }, {}, 'configuration_changed'],
])('withholds deltas across measurement boundaries (%j, %j)', (current, previous, status) => {
    expect(projectLibraryObservationPoints([point('20', current), point('10', previous)])[0])
        .toMatchObject({ comparison: status, delta: null, unchangedComparisons: 0 });
});

test('counts unchanged comparisons without asserting continuous hourly stagnation', () => {
    const result = projectLibraryObservationPoints([point('30', { freshRows: 0 }), point('20'), point('10')]);
    expect(result.map(row => row.unchangedComparisons)).toEqual([2, 1, 0]);
    expect(result[0].delta.freshRows).toBe(-1);
});

test('preserves both a population marker and missing-slot boundary; allowlists persisted fields', () => {
    const output = projectLibraryObservationPoints([point('20', { continuitySince: 'changed', populationFingerprint: 'b'.repeat(64),
        secret: 'PRIVATE', name: 'PRIVATE' }), point('10')]);
    expect(output[0]).toMatchObject({ comparison: 'sampling_gap', populationChanged: true });
    expect(JSON.stringify(output)).not.toContain('PRIVATE');
});

test('missing durable state is an error, while an empty catalog advances only the clock', async () => {
    await expect(captureLibraryObservationSample({ query: jest.fn().mockResolvedValue({ rows: [] }) })).rejects.toThrow('state unavailable');
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ observed_at: '2026-09-05T12:00:00Z', due: true,
        libraries: [], items: [], row_count: 0, active_library_count: 0, next_ceiling: 0,
        expected_last_sample_at: null, continuity_since: '2026-09-05T12:00:00Z', acquisition_configured: false }] })
        .mockResolvedValueOnce({ rows: [{ captured: false }] });
    expect(await captureLibraryObservationSample({ query })).toEqual({ captured: false });
    expect(query.mock.calls[1][1][2]).toBeNull();
});
