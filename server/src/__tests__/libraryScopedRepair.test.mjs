/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { orderedScopedLibraries } from '../scripts/libraryScopedRepair/contract.mjs';
import { normalizeScopedMutations, mutateScopedRepair } from '../scripts/libraryScopedRepair/mutation.mjs';
import { installScopedRepairPrototype } from '../scripts/libraryScopedRepair/schema.mjs';
import { visitScopedRepair } from '../scripts/libraryScopedRepair/visit.mjs';
import { seedScopedFixture } from '../scripts/libraryScopedRepair/fixture.mjs';
import { runLibraryScopedRepairPrototype } from '../scripts/runLibraryScopedRepairPrototype.mjs';

test('normalizes full replacements and declares both sides of moves in numeric order', () => {
    expect(orderedScopedLibraries([10, 2, null, 2, 1])).toEqual([1, 2, 10]);
    expect(normalizeScopedMutations([{ kind: 'replace', id: 2, expectedLibraryId: 1, libraryId: null },
        { kind: 'insert', id: 1, libraryId: 2, fetchedAt: '2026-08-01T00:00:00Z' }])).toMatchObject([
        { id: 1, fetchedAt: '2026-08-01T00:00:00.000Z', metadata: '{}' },
        { id: 2, expectedLibraryId: 1, libraryId: null, mediaType: null, tmdbId: null }
    ]);
});

test.each([
    null, [], Array(129).fill({ kind: 'insert', id: 1, libraryId: 1 }),
    [{ kind: 'insert', id: '1', libraryId: 1 }], [{ kind: 'insert', id: 2147483648, libraryId: 1 }],
    [{ kind: 'delete', id: 1 }], [{ kind: 'replace', id: 1, expectedLibraryId: 1 }],
    [{ kind: 'insert', id: 1, libraryId: 1, sql: 'unexpected' }],
    [{ kind: 'insert', id: 1, libraryId: 1, metadata: 'x'.repeat(65536) }],
    [{ kind: 'insert', id: 1, libraryId: 1, metadata: () => 1 }],
    [{ kind: 'insert', id: 1, libraryId: 1, fetchedAt: 'invalid' }],
    [{ kind: 'insert', id: 1, libraryId: 1, mediaType: 'x'.repeat(33) }],
    [{ kind: 'insert', id: 1, libraryId: 1 }, { kind: 'delete', id: 1, expectedLibraryId: 1 }]
].map(input => [input]))('rejects invalid mutations before opening a transaction (%#)', async input => {
    const db = { query: jest.fn() };
    await expect(mutateScopedRepair(db, 'disposable', input)).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
});

test('refuses application installation and invalid fixture/scope inputs before writes', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ name: 'classifarr' }] }) };
    await expect(installScopedRepairPrototype(db, 'disposable')).rejects.toThrow('disposable database');
    expect(db.query).toHaveBeenCalledTimes(1);
    db.query.mockClear();
    await expect(visitScopedRepair(db, { scope: 'public', libraryId: 1 })).rejects.toThrow('scope');
    await expect(seedScopedFixture(db, { rows: 80002 })).rejects.toThrow('bounds');
    await expect(seedScopedFixture(db, { rows: 2, offset: 2147483646 })).rejects.toThrow();
    await expect(runLibraryScopedRepairPrototype({ argv: ['--database=production'] })).rejects.toThrow('no arguments');
    expect(db.query).not.toHaveBeenCalled();
});

test('rolls back incompatible isolation before acquiring library locks', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{ transaction_isolation: 'repeatable read' }] }) };
    await expect(visitScopedRepair(db, { scope: 'temporary', libraryId: 1 })).rejects.toThrow('read committed');
    expect(db.query).toHaveBeenLastCalledWith('ROLLBACK');
});
