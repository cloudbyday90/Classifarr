/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installInventoryCleanupPrototype } from '../../scripts/inventoryCleanup/schema.mjs';
import { beginInventoryCleanup, appendCleanupManifest, sealCleanupManifest, readCleanupJob, cancelCollectingCleanup } from '../../scripts/inventoryCleanup/jobs.mjs';
import { stepInventoryCleanup } from '../../scripts/inventoryCleanup/step.mjs';
import { seedCleanupItems, syncCleanupItem, drainCleanup } from '../../scripts/inventoryCleanup/fixtures.mjs';
import { withScopedRepairLibraries } from '../../scripts/libraryScopedRepair/locking.mjs';
import { scopedSyncQueries } from '../../scripts/inventoryWriterCompatibility/syncQueries.mjs';
import { waitForRepairBlocking } from '../../scripts/libraryRepairAssessment/concurrency.mjs';

let db, installed;
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN'); await installInventoryCleanupPrototype(db); await db.query('COMMIT'); installed = true;
    await db.query(`INSERT INTO scoped_repair_lab.sync_servers(id) VALUES(1),(2);
        INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id) VALUES(1,1),(2,1),(3,2)`);
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    finally { db.release(); }
});
const count = async () => (await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.scoped_repair_source')).rows[0].n;
async function prune(seen = []) {
    const job = await beginInventoryCleanup(db, { kind: 'prune', targetId: 1 });
    await appendCleanupManifest(db, job.id, seen);
    return sealCleanupManifest(db, job.id, { traversalComplete: true, expectedUniqueCount: new Set(seen).size });
}
function checkpoint(client, matches) {
    let release, signal, reached = false;
    const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { signal = resolve; });
    return { release, ready, fail: () => signal(false), db: { query: async (sql, values) => {
        const result = await client.query(sql, values);
        if (!reached && matches(sql)) { reached = true; signal(true); await gate; }
        return result;
    } } };
}

test('incomplete traversal cannot prune; manifest appends are idempotent and a collecting job is cancellable', async () => {
    await seedCleanupItems(db, { count: 3 });
    const job = await beginInventoryCleanup(db, { kind: 'prune', targetId: 1 });
    await appendCleanupManifest(db, job.id, ['fixture-1', 'fixture-1']);
    expect((await appendCleanupManifest(db, job.id, ['fixture-1'])).seen_count).toBe(1);
    await expect(stepInventoryCleanup(db, job.id)).rejects.toThrow('not ready');
    await expect(sealCleanupManifest(db, job.id, { traversalComplete: false, expectedUniqueCount: 1 })).rejects.toThrow('complete traversal');
    await expect(sealCleanupManifest(db, job.id, { traversalComplete: true, expectedUniqueCount: 2 })).rejects.toThrow('mismatch');
    expect(await count()).toBe(3);
    expect((await cancelCollectingCleanup(db, job.id)).state).toBe('cancelled');
    await expect(sealCleanupManifest(db, job.id, { traversalComplete: true, expectedUniqueCount: 1 })).rejects.toThrow('mismatch');
    expect((await beginInventoryCleanup(db, { kind: 'library', targetId: 1 })).state).toBe('running');
});

test('large pruning commits bounded work, retains exactly seen identities and resumes through another connection', async () => {
    await seedCleanupItems(db, { count: 2051 });
    let job = await prune(['fixture-1', 'fixture-500', 'fixture-2051']);
    job = await stepInventoryCleanup(db, job.id);
    expect(job).toMatchObject({ state: 'running', deleted: 128 });
    await expect(appendCleanupManifest(db, job.id, ['fixture-2'])).rejects.toThrow('not collecting');
    await expect(cancelCollectingCleanup(db, job.id)).rejects.toThrow('Only collecting');
    const peer = await getPool().connect();
    try {
        const result = await drainCleanup(peer, job, 37);
        expect(result.maxSourceDeletes).toBeLessThanOrEqual(37);
        expect(result.job).toMatchObject({ state: 'completed', deleted: 2048 });
        expect(await stepInventoryCleanup(peer, job.id)).toEqual(result.job);
    } finally { peer.release(); }
    expect((await db.query('SELECT external_id FROM scoped_repair_lab.scoped_repair_source ORDER BY id')).rows.map(row => row.external_id))
        .toEqual(['fixture-1', 'fixture-500', 'fixture-2051']);
    expect(await syncCleanupItem(db)).toBe('synced');
});

test.each([0, 1, 128, 129])('an explicitly empty complete manifest drains %i rows and completes only after absence verification', async size => {
    await seedCleanupItems(db, { count: size });
    const result = await drainCleanup(db, await prune());
    expect(result.job).toMatchObject({ state: 'completed', deleted: size }); expect(await count()).toBe(0);
});

test('a library fence rejects late inserts, same-scope updates and moves in; unrelated libraries and moves out proceed', async () => {
    await seedCleanupItems(db, { count: 3 }); await seedCleanupItems(db, { libraryId: 2, count: 1, prefix: 'other-' });
    const job = await prune();
    await expect(syncCleanupItem(db)).rejects.toMatchObject({ code: '55000' });
    await expect(syncCleanupItem(db, { externalId: 'fixture-1' })).rejects.toMatchObject({ code: '55000' });
    await expect(syncCleanupItem(db, { externalId: 'other-1' })).rejects.toMatchObject({ code: '55000' });
    expect(await syncCleanupItem(db, { libraryId: 2, externalId: 'fixture-1' })).toBe('synced');
    expect(await syncCleanupItem(db, { libraryId: 2 })).toBe('synced');
    expect((await drainCleanup(db, job)).job.deleted).toBe(2);
    expect(await count()).toBe(3);
});

test.each(['move', 'delete'])('a source %s after discovery is not reported as a cleanup deletion', async action => {
    await seedCleanupItems(db, { count: 2 }); const job = await prune();
    const peer = await getPool().connect(); let raced = false;
    const observer = { query: async (sql, values) => {
        const result = await db.query(sql, values);
        if (!raced && sql.startsWith('SELECT s.id,s.library_id')) {
            raced = true;
            if (action === 'move') await syncCleanupItem(peer, { libraryId: 2, externalId: 'fixture-1' });
            else await withScopedRepairLibraries(peer, 'disposable', [1], 'write', () => peer.query('DELETE FROM scoped_repair_lab.scoped_repair_source WHERE id=1'));
        }
        return result;
    } };
    try {
        const next = await stepInventoryCleanup(observer, job.id);
        expect(next).toMatchObject({ deleted: 1, moved: action === 'move' ? 1 : 0, absent: action === 'delete' ? 1 : 0 });
        expect((await drainCleanup(db, next)).job.state).toBe('completed');
    } finally { peer.release(); }
});

test.each(['library', 'server'])('direct %s deletion cannot cascade before or during an incomplete drain', async kind => {
    await seedCleanupItems(db, { count: 257 });
    const sql = kind === 'library' ? 'DELETE FROM scoped_repair_lab.sync_libraries WHERE id=1' : 'DELETE FROM scoped_repair_lab.sync_servers WHERE id=1';
    await expect(db.query(sql)).rejects.toMatchObject({ code: '55000' });
    const job = await beginInventoryCleanup(db, { kind, targetId: 1 }); await stepInventoryCleanup(db, job.id);
    await expect(db.query(sql)).rejects.toMatchObject({ code: '55000' }); expect(await count()).toBe(129);
    const result = await drainCleanup(db, await readCleanupJob(db, job.id), 17);
    expect(result.job).toMatchObject({ state: 'completed', deleted: 257, parents_deleted: kind === 'server' ? 3 : 1 });
    expect(result.maxParentDeletes).toBe(1); expect(result.maxSourceDeletes).toBeLessThanOrEqual(17);
});

test('server removal fences new libraries and all source membership, including unassigned rows', async () => {
    await seedCleanupItems(db, { count: 130 }); await seedCleanupItems(db, { libraryId: 2, count: 131, prefix: 'second-' });
    await seedCleanupItems(db, { libraryId: null, count: 129, prefix: 'unassigned-' });
    await seedCleanupItems(db, { serverId: 2, libraryId: 3, count: 5, prefix: 'unrelated-' });
    const job = await beginInventoryCleanup(db, { kind: 'server', targetId: 1 });
    await expect(db.query('INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id) VALUES(4,1)')).rejects.toMatchObject({ code: '55000' });
    await expect(syncCleanupItem(db, { libraryId: null })).rejects.toMatchObject({ code: '55000' });
    expect(await syncCleanupItem(db, { serverId: 2, libraryId: 3 })).toBe('synced');
    const result = await drainCleanup(db, job);
    expect(result.job).toMatchObject({ deleted: 390, parents_deleted: 3, state: 'completed' });
    expect(await count()).toBe(6);
    expect((await db.query('SELECT id FROM scoped_repair_lab.sync_libraries')).rows).toEqual([{ id: 3 }]);
});

test('overlapping scopes on one server reject, while another server can own a cleanup', async () => {
    await prune();
    await expect(beginInventoryCleanup(db, { kind: 'server', targetId: 1 })).rejects.toMatchObject({ code: '23505' });
    await expect(beginInventoryCleanup(db, { kind: 'library', targetId: 2 })).rejects.toMatchObject({ code: '23505' });
    expect((await beginInventoryCleanup(db, { kind: 'server', targetId: 2 })).state).toBe('running');
});

test('empty parents still require the cleanup lock protocol; a missing fence cannot be reported complete', async () => {
    const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    await expect(db.query('DELETE FROM scoped_repair_lab.sync_libraries WHERE id=1')).rejects.toMatchObject({ code: '55000' });
    // Simulate unsupported owner intervention, which must invalidate the job's completion evidence.
    await db.query('UPDATE scoped_repair_lab.sync_libraries SET cleanup_job=NULL WHERE id=1');
    await expect(stepInventoryCleanup(db, job.id)).rejects.toThrow('fence is missing');
    expect((await readCleanupJob(db, job.id)).state).toBe('running');
});

test('parent ownership and source identity cannot change; cross-server library mismatches reject', async () => {
    await seedCleanupItems(db, { count: 1 });
    await expect(db.query('UPDATE scoped_repair_lab.sync_libraries SET media_server_id=2 WHERE id=1')).rejects.toMatchObject({ code: '55000' });
    await expect(withScopedRepairLibraries(db, 'disposable', [1], 'write', () =>
        db.query("UPDATE scoped_repair_lab.scoped_repair_source SET external_id='new-identity' WHERE id=1"))).rejects.toMatchObject({ code: '55000' });
    await expect(syncCleanupItem(db, { serverId: 2, libraryId: 1 })).rejects.toMatchObject({ code: '55000' });
    expect(await count()).toBe(1);
});

test('failed progress persistence rolls back every deletion and a later step resumes with exact counts', async () => {
    await seedCleanupItems(db, { count: 257 }); const job = await prune();
    const faulty = { query: (sql, values) => sql.startsWith('UPDATE scoped_repair_lab.cleanup_jobs SET cursor_id=$2') ?
        Promise.reject(new Error('injected checkpoint failure')) : db.query(sql, values) };
    await expect(stepInventoryCleanup(faulty, job.id)).rejects.toThrow('injected checkpoint');
    expect(await count()).toBe(257); expect(await readCleanupJob(db, job.id)).toMatchObject({ cursor_id: 0, deleted: 0 });
    expect((await drainCleanup(db, job)).job.deleted).toBe(257);
});

test('an advanced stale checkpoint cannot hide remaining target rows or claim completion', async () => {
    await seedCleanupItems(db, { count: 3 }); const job = await prune(['fixture-1']);
    // Simulate an obsolete persisted cursor: the independent completion check must catch it.
    await db.query('UPDATE scoped_repair_lab.cleanup_jobs SET cursor_id=high_id WHERE id=$1', [job.id]);
    const next = await stepInventoryCleanup(db, job.id);
    expect(next).toMatchObject({ state: 'running', cursor_id: 0, deleted: 0 });
    expect(await count()).toBe(3);
    expect((await drainCleanup(db, next)).job).toMatchObject({ state: 'completed', deleted: 2 });
    expect(await count()).toBe(1);
});

test('an admitted in-flight sync makes fencing retry atomically; after its commit the row belongs to the drain', async () => {
    const peer = await getPool().connect(), hook = checkpoint(peer, sql => sql === scopedSyncQueries().upsert);
    const pending = syncCleanupItem(hook.db).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true);
        await expect(beginInventoryCleanup(db, { kind: 'library', targetId: 1 })).rejects.toMatchObject({ code: '55P03' });
        expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.cleanup_jobs')).rows[0].n).toBe(0);
        hook.release(); expect((await pending).value).toBe('synced');
        const result = await drainCleanup(db, await beginInventoryCleanup(db, { kind: 'library', targetId: 1 }));
        expect(result.job.deleted).toBe(1);
    } finally { hook.release(); await pending; peer.release(); }
});

test('a fence in flight makes new sync retry without admitting a row', async () => {
    const peer = await getPool().connect();
    const hook = checkpoint(peer, sql => sql.startsWith('UPDATE scoped_repair_lab.sync_libraries SET cleanup_job=$2'));
    const pending = beginInventoryCleanup(hook.db, { kind: 'library', targetId: 1 }).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true);
        await expect(syncCleanupItem(db)).rejects.toMatchObject({ code: '55P03' });
        hook.release(); const result = await pending; expect(result.error).toBeUndefined();
        expect(await count()).toBe(0); expect((await drainCleanup(db, result.value)).job.state).toBe('completed');
    } finally { hook.release(); await pending; peer.release(); }
});

test('two workers serialize job progress while unrelated sync continues', async () => {
    await seedCleanupItems(db, { count: 300 }); const job = await prune();
    const first = await getPool().connect(), second = await getPool().connect();
    const hook = checkpoint(first, sql => sql.startsWith('SELECT * FROM scoped_repair_lab.cleanup_jobs') && sql.endsWith(' FOR UPDATE'));
    let right;
    const left = stepInventoryCleanup(hook.db, job.id).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true);
        const pid = (await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        right = stepInventoryCleanup(second, job.id).then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(db, pid);
        expect(await syncCleanupItem(db, { libraryId: 2 })).toBe('synced');
        hook.release(); expect((await left).value.deleted).toBe(128); expect((await right).value.deleted).toBe(256);
        expect((await drainCleanup(db, await readCleanupJob(db, job.id))).job.deleted).toBe(300);
    } finally { hook.release(); await left; if (right) await right; first.release(); second.release(); }
});

test('backend termination rolls back an uncommitted batch and a new connection resumes the durable job', async () => {
    await seedCleanupItems(db, { count: 257 }); const job = await prune();
    const peer = await getPool().connect(); peer.on('error', () => {});
    const pid = (await peer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const hook = checkpoint(peer, sql => sql.startsWith('DELETE FROM scoped_repair_lab.scoped_repair_source s'));
    const pending = stepInventoryCleanup(hook.db, job.id).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true);
        await db.query('SELECT pg_terminate_backend($1)', [pid]); hook.release();
        expect((await pending).error).toBeDefined();
        expect(await count()).toBe(257); expect(await readCleanupJob(db, job.id)).toMatchObject({ cursor_id: 0, deleted: 0 });
        const resumed = await getPool().connect();
        try { expect((await drainCleanup(resumed, job)).job.deleted).toBe(257); } finally { resumed.release(); }
    } finally { hook.release(); await pending; peer.release(true); }
});
