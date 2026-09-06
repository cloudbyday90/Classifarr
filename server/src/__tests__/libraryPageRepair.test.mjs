/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { journalContinuity, pageRepairNamespace, pageRepairRange } from '../scripts/libraryPageRepair/contract.mjs';
import { reducePageRepairRows } from '../scripts/libraryPageRepair/projection.mjs';
import { installPageRepairPrototype } from '../scripts/libraryPageRepair/schema.mjs';
import { seedPageRepairFixture, pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME as now } from '../scripts/libraryPageRepair/fixture.mjs';
import { visitPageRepair, visitPageRepairInTransaction } from '../scripts/libraryPageRepair/visit.mjs';
import { runLibraryPageRepairPrototype } from '../scripts/runLibraryPageRepairPrototype.mjs';
import { inventoryObservationValidityCases } from './helpers/inventoryObservationValidityCases.mjs';

const item = (record, extra = {}) => ({ id: 1, media_type: 'movie', tmdb_id: 7, metadata: { inventory_tmdb: record },
    has_observation: record !== undefined, inventory_tmdb_fetched_at: '2026-08-01T00:00:00Z', ...extra });

test.each(inventoryObservationValidityCases)('page projection respects explicit validity: $name', ({ record, reusable }) => {
    expect(reducePageRepairRows([item(record)], now).counts).toMatchObject({ inventory: 1, captured: Number(reusable), fresh: Number(reusable) });
});

test('page counters expire at exact freshness and future-clock boundaries', () => {
    const record = inventoryObservationValidityCases[0].record;
    const before = reducePageRepairRows([item(record)], now);
    expect(before.expiresAt).toBe('2026-08-31T00:00:00.000Z');
    expect(reducePageRepairRows([item(record)], Date.parse(before.expiresAt)).counts.fresh).toBe(0);
    const future = item(record, { inventory_tmdb_attempted_at: '2026-08-03T00:00:00Z' });
    expect(reducePageRepairRows([future], now)).toMatchObject({ expiresAt: '2026-08-03T00:00:00.000Z', counts: { fresh: 0 } });
    expect(reducePageRepairRows([future], Date.parse('2026-08-03T00:00:00Z')).counts.fresh).toBe(1);
    expect(reducePageRepairRows([item(record, { inventory_tmdb_fetched_at: 'invalid' })], now).expiresAt).toBeNull();
    expect(reducePageRepairRows([item(record, { observation_withheld: true })], now).counts.captured).toBe(0);
});

test('continuity preserves exact bigint sequence values and rejects omissions, overflow and generation changes', () => {
    const state = { generation: '1', acknowledged_sequence: '9007199254740992' };
    const head = { generation: '1', sequence: '9007199254740994' };
    expect(journalContinuity(state, head, [{ sequence: '9007199254740993' }, { sequence: head.sequence }])).toBeNull();
    expect(journalContinuity(state, head, [{ sequence: head.sequence }])).toBe('missing_continuity');
    expect(journalContinuity(state, { ...head, sequence: '0' }, [])).toBe('missing_continuity');
    expect(journalContinuity(state, { ...head, sequence: '9007199254741249' }, [])).toBe('journal_overflow');
    expect(journalContinuity(state, { ...head, generation: '2', reason: 'unsupported_change' }, [])).toBe('unsupported_change');
});

test('invalid scope, range, library, fixture and CLI arguments fail before data access', async () => {
    expect(() => pageRepairNamespace('public')).toThrow('scope');
    expect(pageRepairRange(107374)).toEqual([2147480001, 2147483647]);
    expect(() => pageRepairRange(107375)).toThrow('range');
    expect(() => reducePageRepairRows(Array(20001), now)).toThrow('projection');
    expect(() => pageRepairClock({}, NaN)).toThrow('clock');
    const db = { query: jest.fn() };
    await expect(seedPageRepairFixture(db, 'temporary', 80002)).rejects.toThrow('size');
    await expect(visitPageRepairInTransaction(db, { scope: 'temporary', libraryId: '1' })).rejects.toThrow('library');
    await expect(runLibraryPageRepairPrototype({ argv: ['--database=production'] })).rejects.toThrow('no arguments');
    expect(db.query).not.toHaveBeenCalled();
});

test('permanent installation refuses an application database before DDL', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ name: 'classifarr' }] }) };
    await expect(installPageRepairPrototype(db, 'disposable')).rejects.toThrow('disposable database');
    expect(db.query).toHaveBeenCalledTimes(1);
});

test('visit errors roll back rather than leave the publication lock held', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ transaction_isolation: 'repeatable read' }] }) };
    await expect(visitPageRepair(db, { scope: 'temporary', libraryId: 1 })).rejects.toThrow('read committed');
    expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');
});
