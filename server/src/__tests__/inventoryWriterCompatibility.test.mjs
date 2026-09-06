/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, test, expect, jest } from '@jest/globals';
import { evaluateWriterInventory } from '../scripts/inventoryWriterCompatibility/inventory.mjs';
import { extractWriterSqlSources } from '../scripts/inventoryWriterCompatibility/sqlSources.mjs';
import { findWriterOperations } from '../scripts/inventoryWriterCompatibility/operations.mjs';
import { createScopedSyncAdapter } from '../scripts/inventoryWriterCompatibility/syncAdapter.mjs';
import { READ_SYNC_ITEM, UPSERT_SYNC_ITEM } from '../services/mediaSyncItemQueries.mjs';
import { runInventoryWriterCompatibility } from '../scripts/runInventoryWriterCompatibility.mjs';
import { runInventorySyncCompatibility } from '../scripts/runInventorySyncCompatibility.mjs';

const schema = { path: 'database/schema/current.sql', source: `ALTER TABLE ONLY public.media_server_items
    ADD CONSTRAINT item_library FOREIGN KEY (library_id) REFERENCES public.libraries(id) ON DELETE CASCADE;
    ALTER TABLE ONLY public.libraries ADD CONSTRAINT library_server FOREIGN KEY (server_id) REFERENCES public.media_server(id) ON DELETE CASCADE;
    CREATE TRIGGER item_change AFTER UPDATE ON public.media_server_items FOR EACH STATEMENT EXECUTE FUNCTION public.capture();` };

test('discovers direct, CTE, quoted and cascade writers while ignoring comments and SQL string data', () => {
    const report = evaluateWriterInventory([schema, { path: 'server/src/services/example.mjs', source: `
        // UPDATE media_server_items SET x=1
        const read = "SELECT 'UPDATE media_server_items SET x=1'";
        const update = 'WITH a AS (UPDATE "public"."media_server_items" SET tmdb_id=$1 WHERE xmin::text=$2 RETURNING id) SELECT * FROM a';
        const deletion = 'DELETE FROM ONLY libraries WHERE id=$1';
        const ancestor = 'DELETE FROM media_server WHERE id=$1';` }]);
    expect(report.candidates.map(item => [item.operation, item.target, item.kind])).toEqual([
        ['UPDATE', 'media_server_items', 'direct'], ['DELETE', 'libraries', 'cascade_parent'], ['DELETE', 'media_server', 'cascade_parent']
    ]);
    expect(report.triggers).toMatchObject([{ name: 'item_change', function: 'public.capture' }]);
    expect(report.productionCompatible).toBe(false);
});

test('handles multi-table truncate, COPY direction and MERGE without treating ON CONFLICT SET as a target', () => {
    expect(findWriterOperations(`TRUNCATE unrelated, ONLY public.media_server_items; COPY media_server_items TO STDOUT;
        COPY media_server_items FROM STDIN; INSERT INTO media_server_items VALUES(1) ON CONFLICT DO UPDATE SET x=1;
        MERGE INTO libraries USING incoming ON true WHEN MATCHED THEN DELETE;`).map(item => [item.operation, item.target])).toEqual([
        ['TRUNCATE', 'unrelated'], ['TRUNCATE', 'public.media_server_items'], ['COPY', 'media_server_items'],
        ['INSERT', 'media_server_items'], ['MERGE', 'libraries']
    ]);
});

test('exposes dynamic targets, indirect query arguments, parse failures and unsupported languages', () => {
    const report = evaluateWriterInventory([schema,
        { path: 'server/src/services/dynamic.mjs', source: 'db.query(`UPDATE ${table} SET x=$1`, [1]); query(SQL, []);' },
        { path: 'execution/test.py', source: 'pass' }, { path: 'server/src/broken.mjs', source: 'const = ;' }]);
    expect(report.candidates).toMatchObject([{ target: '__dynamic__', kind: 'dynamic_target' }]);
    expect(report.gaps.map(item => item.reason).sort()).toEqual(['indirect_query_argument', 'source_parse_error', 'unsupported_source_language']);
});

test('does not execute scanned code or honor inline comments that disable collection', () => {
    const value = extractWriterSqlSources({ path: 'untrusted.mjs', source: `/* eslint-disable inventory/collect */
        throw new Error('must not run'); const sql = 'DELETE FROM media_server_items';` });
    expect(value.fragments.some(item => item.text === 'DELETE FROM media_server_items')).toBe(true);
});

test('fingerprints are deterministic under enumeration order and change with source content', () => {
    const file = { path: 'server/src/a.mjs', source: 'export const n=1;' };
    const before = evaluateWriterInventory([schema, file]);
    expect(evaluateWriterInventory([file, schema]).sourceFingerprint).toBe(before.sourceFingerprint);
    expect(evaluateWriterInventory([schema, { ...file, source: 'export const n=2;' }]).sourceFingerprint).not.toBe(before.sourceFingerprint);
    expect(evaluateWriterInventory([file]).gaps).toContainEqual({ path: schema.path, line: 1, reason: 'missing_authoritative_schema' });
});

test.each([
    ['SELECT arbitrary', []], [READ_SYNC_ITEM, ['1', 'key']], [READ_SYNC_ITEM, [1, 'x'.repeat(101)]],
    [READ_SYNC_ITEM, [1, 'bad\0key']], [UPSERT_SYNC_ITEM, []],
    [UPSERT_SYNC_ITEM, [1, 1, 'key', null, null, null, 'Title', null, null, 'movie', [], [], [], null, null, null, '{}', 'bad', false]],
    [UPSERT_SYNC_ITEM, [1, 1, 'key', null, null, null, 'Title', null, null, 'movie', [], [], [], null, null, null, 'x'.repeat(65537), null, false]]
])('rejects invalid adapter input before opening a transaction (%#)', async (operation, values) => {
    const db = { query: jest.fn() };
    await expect(createScopedSyncAdapter(db)(operation, values)).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
});

test('refuses concurrent adapter calls while an owned query is outstanding', async () => {
    let finish;
    const query = createScopedSyncAdapter({ query: () => new Promise(resolve => { finish = resolve; }) });
    const first = query(READ_SYNC_ITEM, [1, 'key']);
    await expect(query(READ_SYNC_ITEM, [1, 'other'])).rejects.toThrow('Concurrent');
    finish({ rows: [] }); await expect(first).resolves.toEqual({ rows: [] });
    await expect(runInventorySyncCompatibility({ argv: ['--database=production'] })).rejects.toThrow('no arguments');
});

describe('repository source inventory', () => {
    test('finds current sync, cascade and restore candidates without connections', () => {
    expect(() => runInventoryWriterCompatibility(['--database=production'])).toThrow('no arguments');
    const report = runInventoryWriterCompatibility([]);
    expect(report).toMatchObject({ databaseConnections: 0, providerRequests: 0, writes: 0, productionCompatible: false });
    expect(report.candidates).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'server/src/services/mediaSyncItemQueries.mjs', kind: 'direct', operation: 'INSERT' }),
        expect.objectContaining({ path: 'server/src/services/backupRestore.mjs', kind: 'cascade_parent' }),
        expect.objectContaining({ path: 'server/src/services/backupRestoreTables.mjs', kind: 'dynamic_target' })
    ]));
    expect(report.triggers).toHaveLength(6);
    }, 30000);
});
