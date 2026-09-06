/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { readRepairOccupancy } from '../scripts/libraryRepairAssessment/occupancy.mjs';
import { runLibraryRepairLifecycleAssessment } from '../scripts/runLibraryRepairLifecycleAssessment.mjs';

function source(catalog, populations) {
    return { query: jest.fn(async (sql, values) => {
        if (sql.includes('measured_at')) return { rows: [{ measured_at: '2026-08-31T00:00:00Z' }] };
        if (sql.includes('WHERE is_active')) return { rows: catalog.map(id => ({ id })) };
        if (sql.includes('WHERE (library_id,id)')) return { rows: (populations[values[0]] ?? []).slice(0, values[1]).map(id => ({ id })) };
        return { rows: [] };
    }) };
}

test('reports real fixed-range occupancy without exposing identifiers or reading metadata', async () => {
    const db = source([1234567, 7654321], { 1234567: [1, 2, 40001], 7654321: [] });
    const result = await readRepairOccupancy(db, 'inventory');
    expect(result).toMatchObject({ complete: true, itemRowsRead: 3, metadataRowsRead: 0, observedRanges: 2, fitsGlobalCapacity: true,
        libraries: [{ ordinal: 1, observedItems: 3, observedRanges: 2, rangeUtilizationPercent: 0.0075, complete: true },
            { ordinal: 2, observedItems: 0, observedRanges: 0, rangeUtilizationPercent: null, complete: true }] });
    expect(JSON.stringify(result)).not.toMatch(/1234567|7654321|40001/);
    expect(db.query.mock.calls.every(([sql]) => !sql.includes('metadata'))).toBe(true);
    expect(db.query).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(db.query).toHaveBeenLastCalledWith('COMMIT');
});

test('one global item sentinel withholds fit when incomplete evidence still fits the observed cap', async () => {
    const db = source([1, 2], { 1: Array.from({ length: 200001 }, (_, index) => index + 1) });
    const result = await readRepairOccupancy(db, 'prototype');
    expect(result).toMatchObject({ complete: false, observedItems: 200000, itemRowsRead: 200001, fitsGlobalCapacity: null });
    expect(result.libraries).toHaveLength(1);
    expect(result.libraries[0]).toMatchObject({ complete: false, fitsPageCapacity: null });
});

test('an observed capacity breach stays false even when the rest of the population is unknown', async () => {
    const db = source([1], { 1: Array.from({ length: 200001 }, (_, index) => index * 10000 + 1) });
    expect(await readRepairOccupancy(db, 'prototype')).toMatchObject({ complete: false, fitsGlobalCapacity: false,
        libraries: [{ fitsPageCapacity: false, complete: false }] });
});

test('exact item boundary can be complete, with subsequent empty libraries assessed without extra item rows', async () => {
    const db = source([1, 2], { 1: Array.from({ length: 200000 }, (_, index) => index + 1) });
    expect(await readRepairOccupancy(db, 'prototype')).toMatchObject({ complete: true, itemRowsRead: 200000, fitsGlobalCapacity: true });
});

test('catalog sentinel reports the cursor capacity breach and reads at most 32 populations', async () => {
    const db = source(Array.from({ length: 33 }, (_, index) => index + 1), {});
    const result = await readRepairOccupancy(db, 'prototype');
    expect(result).toMatchObject({ complete: false, catalogRowsRead: 33, fitsGlobalCapacity: false });
    expect(result.libraries).toHaveLength(32);
});

test('unsafe source and connection arguments fail before database or Docker access', async () => {
    const db = source([], {});
    await expect(readRepairOccupancy(db, 'public.secret')).rejects.toThrow('source');
    await expect(runLibraryRepairLifecycleAssessment({ argv: ['--database=PRIVATE'] })).rejects.toThrow('no arguments');
    expect(db.query).not.toHaveBeenCalled();
});

test('a read failure rolls back its snapshot', async () => {
    const db = source([], {});
    db.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('read failed'));
    await expect(readRepairOccupancy(db, 'inventory')).rejects.toThrow('read failed');
    expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');
});
