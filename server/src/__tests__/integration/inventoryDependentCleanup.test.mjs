/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installDependentCleanupPrototype } from '../../scripts/inventoryDependentCleanup/schema.mjs';
import { stepDependentCleanup } from '../../scripts/inventoryDependentCleanup/step.mjs';
import { beginInventoryCleanup, appendCleanupManifest, sealCleanupManifest, readCleanupJob } from '../../scripts/inventoryCleanup/jobs.mjs';
import { seedCleanupItems, syncCleanupItem } from '../../scripts/inventoryCleanup/fixtures.mjs';
import { readInventoryDeletionPlan } from '../../scripts/inventoryDeletionPlan/catalog.mjs';
import { CLEANUP_LOCK_NAMESPACE } from '../../scripts/inventoryCleanup/contract.mjs';
import { waitForRepairBlocking } from '../../scripts/libraryRepairAssessment/concurrency.mjs';

let db, installed;
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN'); await installDependentCleanupPrototype(db); await db.query('COMMIT'); installed = true;
    await db.query(`INSERT INTO scoped_repair_lab.sync_servers(id) VALUES(1),(2);
        INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id,name) VALUES(1,1,'Original library'),(2,1,'Other library'),(3,2,'Other server')`);
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    finally { db.release(); }
});
async function prune(seen = []) {
    const job = await beginInventoryCleanup(db, { kind: 'prune', targetId: 1 }); await appendCleanupManifest(db, job.id, seen);
    return sealCleanupManifest(db, job.id, { traversalComplete: true, expectedUniqueCount: seen.length });
}
const total = job => ['deleted', 'parents_deleted', 'dependents_deleted', 'history_detached'].reduce((sum, key) => sum + Number(job[key]), 0);
async function drain(client, job, budget = 128) {
    let steps = 0;
    while (job.state !== 'completed') {
        if (++steps > 5000) throw new Error('Dependent fixture did not converge');
        const next = await stepDependentCleanup(client, job.id, { budget });
        expect(total(next) - total(job)).toBeLessThanOrEqual(budget); job = next;
    }
    return job;
}
async function seedDependents(itemId, count = 257) {
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_retries(item_id,payload) SELECT $1,jsonb_build_object('attempt',n) FROM generate_series(1,$2::integer) n;
    `.trim(), [itemId, count]);
    await db.query('INSERT INTO scoped_repair_lab.cleanup_previews(item_id,payload) SELECT $1,jsonb_build_object(\'actor\',n) FROM generate_series(1,$2::integer) n', [itemId, count]);
}
function checkpoint(client, match) {
    let release, signal, reached = false;
    const gate = new Promise(resolve => { release = resolve; }), ready = new Promise(resolve => { signal = resolve; });
    return { release, ready, fail: () => signal(false), db: { query: async (sql, values) => {
        const result = await client.query(sql, values);
        if (!reached && match(sql)) { reached = true; signal(true); await gate; }
        return result;
    } } };
}

test('catalog discovers the transitive production graph and preserves explicit history disposition without reading items', async () => {
    const result = await readInventoryDeletionPlan(db);
    expect(result).toMatchObject({ writes: 0, itemRowsRead: 0, executable: false, productionReady: false });
    expect(result.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ child: 'public.enrichment_retry_queue', disposition: 'delete_item_dependent', validated: true, enforced: true }),
        expect.objectContaining({ child: 'public.classification_history', disposition: 'preserve_history_detach' }),
        expect.objectContaining({ child: 'public.media_identity_review_previews', disposition: 'delete_item_dependent' })]));
    const faulty = { query: (sql, values) => sql.startsWith('SELECT format') ? db.query('DELETE FROM public.media_server_items') : db.query(sql, values) };
    await expect(readInventoryDeletionPlan(faulty)).rejects.toMatchObject({ code: '25006' });
});

test('catalog distinguishes unvalidated composite FKs and partial versus complete leading-key indexes', async () => {
    await db.query(`CREATE TABLE scoped_repair_lab.plan_parent(x integer,y integer,PRIMARY KEY(x,y));
        CREATE TABLE scoped_repair_lab.plan_child(a integer,b integer);
        ALTER TABLE scoped_repair_lab.plan_child ADD CONSTRAINT composite_fk FOREIGN KEY(a,b) REFERENCES scoped_repair_lab.plan_parent(x,y) ON DELETE RESTRICT NOT VALID;
        CREATE INDEX partial_child ON scoped_repair_lab.plan_child(b,a) WHERE a>0`);
    const first = await readInventoryDeletionPlan(db, ['scoped_repair_lab.plan_parent']);
    expect(first.edges[0]).toMatchObject({ childColumns: ['a', 'b'], parentColumns: ['x', 'y'], onDelete: 'RESTRICT', validated: false, childIndex: false });
    await db.query('CREATE INDEX complete_child ON scoped_repair_lab.plan_child(b,a)');
    const second = await readInventoryDeletionPlan(db, ['scoped_repair_lab.plan_parent']);
    expect(second.edges[0].childIndex).toBe(true); expect(second.fingerprint).not.toBe(first.fingerprint);
});

test.each([1, 17, 128])('item fan-out and source deletion share a %i-row mutation budget and resume on another connection', async budget => {
    await seedCleanupItems(db, { count: 2 }); await seedDependents(1, 129); await seedDependents(2, 3);
    let job = await prune(['fixture-2']); job = await stepDependentCleanup(db, job.id, { budget });
    expect(job.state).toBe('running'); expect(Number(job.dependents_deleted)).toBe(budget);
    const peer = await getPool().connect();
    try { job = await drain(peer, job, budget); } finally { peer.release(); }
    expect(job).toMatchObject({ deleted: 1, dependents_deleted: 258 });
    expect((await db.query('SELECT item_id FROM scoped_repair_lab.cleanup_retries')).rows).toHaveLength(3);
    expect((await db.query('SELECT id FROM scoped_repair_lab.scoped_repair_source')).rows).toEqual([{ id: 2 }]);
    expect(await stepDependentCleanup(db, job.id)).toEqual(job);
});

test('a move before reservation preserves the source and every dependent', async () => {
    await seedCleanupItems(db, { count: 1 }); await seedDependents(1, 3); const job = await prune();
    const peer = await getPool().connect(); let raced = false;
    const wrapper = { query: async (sql, values) => {
        const result = await db.query(sql, values);
        if (!raced && sql.startsWith('SELECT s.id,s.library_id')) { raced = true; await syncCleanupItem(peer, { libraryId: 2, externalId: 'fixture-1' }); }
        return result;
    } };
    try {
        const result = await drain(db, await stepDependentCleanup(wrapper, job.id));
        expect(result).toMatchObject({ deleted: 0, moved: 1, dependents_deleted: 0 });
        expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.cleanup_previews')).rows[0].n).toBe(3);
    } finally { peer.release(); }
});

test('reservation fences moves and dependent inserts after partial progress while unrelated items remain writable', async () => {
    await seedCleanupItems(db, { count: 1 }); await seedDependents(1); const job = await prune();
    const next = await stepDependentCleanup(db, job.id, { budget: 1 });
    await expect(syncCleanupItem(db, { libraryId: 2, externalId: 'fixture-1' })).rejects.toMatchObject({ code: '55000' });
    await expect(db.query('INSERT INTO scoped_repair_lab.cleanup_retries(item_id) VALUES(1)')).rejects.toMatchObject({ code: '55000' });
    expect(await syncCleanupItem(db, { libraryId: 2 })).toBe('synced');
    expect((await drain(db, next)).dependents_deleted).toBe(514);
});

test('dependent admission racing with a source reservation uses NOWAIT and cannot create a late child', async () => {
    await seedCleanupItems(db, { count: 1 }); const job = await prune(); const peer = await getPool().connect();
    const hook = checkpoint(peer, sql => sql.startsWith('INSERT INTO scoped_repair_lab.cleanup_item_claims'));
    const pending = stepDependentCleanup(hook.db, job.id).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true);
        await expect(db.query('INSERT INTO scoped_repair_lab.cleanup_previews(item_id) VALUES(1)')).rejects.toMatchObject({ code: '55P03' });
        hook.release(); expect((await pending).error).toBeUndefined();
    } finally { hook.release(); await pending; peer.release(); }
});

test('an admitted dependent write makes parent fencing retry atomically', async () => {
    await seedCleanupItems(db, { count: 1 }); const peer = await getPool().connect();
    try {
        await peer.query('BEGIN'); await peer.query('INSERT INTO scoped_repair_lab.cleanup_retries(item_id) VALUES(1)');
        await expect(beginInventoryCleanup(db, { kind: 'library', targetId: 1 })).rejects.toMatchObject({ code: '55P03' });
        await peer.query('COMMIT');
        expect((await drain(db, await beginInventoryCleanup(db, { kind: 'library', targetId: 1 }))).dependents_deleted).toBe(1);
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});

test.each(['library', 'server'])('%s cleanup drains parent dependents and preserves history/audit values', async kind => {
    await seedCleanupItems(db, { count: 2 }); await seedDependents(1, 3);
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_collections(media_server_id,library_id) SELECT 1,1 FROM generate_series(1,129);
        INSERT INTO scoped_repair_lab.cleanup_status(media_server_id,library_id) SELECT 1,1 FROM generate_series(1,130);
        INSERT INTO scoped_repair_lab.cleanup_history(library_id,status,library_name,error_message,audit) VALUES
            (1,'completed',NULL,NULL,'{"actor":1}'),(1,'completed','Retained name','Retained error','{"actor":2}'),
            (1,'pending',NULL,NULL,'{"actor":3}'),(3,'completed','Unrelated',NULL,'{"actor":4}')`);
    const job = await drain(db, await beginInventoryCleanup(db, { kind, targetId: 1 }), 7);
    expect(job).toMatchObject({ deleted: 2, dependents_deleted: 265, history_detached: 3, parents_deleted: kind === 'server' ? 3 : 1 });
    expect((await db.query('SELECT library_id,status,library_name,error_message,audit FROM scoped_repair_lab.cleanup_history ORDER BY id')).rows).toEqual([
        { library_id: null, status: 'failed', library_name: 'Original library', error_message: 'Library was deleted after this item was classified', audit: { actor: 1 } },
        { library_id: null, status: 'failed', library_name: 'Retained name', error_message: 'Retained error', audit: { actor: 2 } },
        { library_id: null, status: 'pending', library_name: null, error_message: null, audit: { actor: 3 } },
        { library_id: 3, status: 'completed', library_name: 'Unrelated', error_message: null, audit: { actor: 4 } }]);
});

test('server cleanup includes parent dependents without a library', async () => {
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_collections(media_server_id,library_id) VALUES(1,NULL),(2,NULL);
        INSERT INTO scoped_repair_lab.cleanup_status(media_server_id,library_id) VALUES(1,NULL),(2,NULL)`);
    const job = await drain(db, await beginInventoryCleanup(db, { kind: 'server', targetId: 1 }), 1);
    expect(job).toMatchObject({ dependents_deleted: 2, parents_deleted: 3 });
    expect((await db.query('SELECT media_server_id FROM scoped_repair_lab.cleanup_status')).rows).toEqual([{ media_server_id: 2 }]);
});

test('history cannot be deleted or silently detached and audit payload cannot change through cleanup admission', async () => {
    await db.query("INSERT INTO scoped_repair_lab.cleanup_history(library_id,status,audit) VALUES(1,'completed','{\"actor\":1}')");
    await expect(db.query('DELETE FROM scoped_repair_lab.cleanup_history')).rejects.toMatchObject({ code: '55000' });
    await expect(db.query('UPDATE scoped_repair_lab.cleanup_history SET library_id=NULL')).rejects.toMatchObject({ code: '55000' });
    await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    await db.query('BEGIN');
    try {
        await db.query('SELECT pg_advisory_xact_lock($1,1)', [CLEANUP_LOCK_NAMESPACE]);
        await expect(db.query("UPDATE scoped_repair_lab.cleanup_history SET library_id=NULL,status='failed',library_name='Original library',error_message='Library was deleted after this item was classified',audit='{}'"))
            .rejects.toMatchObject({ code: '55000' });
    } finally { await db.query('ROLLBACK'); }
});

test('dependent mutations and reservations roll back when the job checkpoint fails', async () => {
    await seedCleanupItems(db, { count: 1 }); await seedDependents(1, 3); const job = await prune();
    const faulty = { query: (sql, values) => sql.startsWith('UPDATE scoped_repair_lab.cleanup_jobs SET visited=visited+$2') ?
        Promise.reject(new Error('checkpoint interrupted')) : db.query(sql, values) };
    await expect(stepDependentCleanup(faulty, job.id)).rejects.toThrow('checkpoint interrupted');
    expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.cleanup_retries')).rows[0].n).toBe(3);
    expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.cleanup_item_claims')).rows[0].n).toBe(0);
    expect(await readCleanupJob(db, job.id)).toMatchObject({ deleted: 0, dependents_deleted: 0 });
    expect((await drain(db, job)).dependents_deleted).toBe(6);
});

test('an unknown cascading dependent stops the batch before any domain mutation', async () => {
    await seedCleanupItems(db, { count: 1 }); await seedDependents(1, 3); const job = await prune();
    await db.query(`CREATE TABLE scoped_repair_lab.unknown_child(item_id integer REFERENCES scoped_repair_lab.scoped_repair_source ON DELETE CASCADE);
        INSERT INTO scoped_repair_lab.unknown_child VALUES(1)`);
    await expect(stepDependentCleanup(db, job.id)).rejects.toThrow('schema contract changed');
    expect(await readCleanupJob(db, job.id)).toMatchObject({ deleted: 0, dependents_deleted: 0 });
    expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.cleanup_retries')).rows[0].n).toBe(3);
});

test.each([
    'ALTER TABLE scoped_repair_lab.cleanup_retries ADD COLUMN unexpected text',
    'CREATE RULE unexpected_cleanup AS ON DELETE TO scoped_repair_lab.cleanup_retries DO INSTEAD NOTHING',
    "CREATE OR REPLACE FUNCTION scoped_repair_lab.dependent_admission(server_id integer,lib_id integer) RETURNS void LANGUAGE plpgsql AS $body$ BEGIN RETURN; END $body$",
])('column, rewrite and helper-function drift invalidate the recorded cleanup contract: %s', async ddl => {
    await seedCleanupItems(db, { count: 1 }); await seedDependents(1, 3); const job = await prune();
    await db.query(ddl);
    await expect(stepDependentCleanup(db, job.id)).rejects.toThrow('schema contract changed');
    expect(await readCleanupJob(db, job.id)).toMatchObject({ deleted: 0, dependents_deleted: 0 });
});

test('new parent dependents and history cannot enter a draining scope', async () => {
    await beginInventoryCleanup(db, { kind: 'server', targetId: 1 });
    await expect(db.query('INSERT INTO scoped_repair_lab.cleanup_collections(media_server_id,library_id) VALUES(1,NULL)')).rejects.toMatchObject({ code: '55000' });
    await expect(db.query('INSERT INTO scoped_repair_lab.cleanup_status(media_server_id,library_id) VALUES(1,1)')).rejects.toMatchObject({ code: '55000' });
    await expect(db.query("INSERT INTO scoped_repair_lab.cleanup_history(library_id,status) VALUES(1,'pending')")).rejects.toMatchObject({ code: '55000' });
});

test('backend termination after a committed reservation resumes dependent counts through another connection', async () => {
    await seedCleanupItems(db, { count: 1 }); await seedDependents(1, 129); let job = await prune();
    job = await stepDependentCleanup(db, job.id, { budget: 1 });
    const peer = await getPool().connect(); peer.on('error', () => {});
    const pid = (await peer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const hook = checkpoint(peer, sql => sql.startsWith('WITH batch AS (SELECT id FROM scoped_repair_lab.cleanup_retries'));
    const pending = stepDependentCleanup(hook.db, job.id).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true); await db.query('SELECT pg_terminate_backend($1)', [pid]); hook.release();
        expect((await pending).error).toBeDefined();
        expect(await readCleanupJob(db, job.id)).toMatchObject({ deleted: 0, dependents_deleted: 1 });
        const resumed = await getPool().connect();
        try { expect((await drain(resumed, job)).dependents_deleted).toBe(258); } finally { resumed.release(); }
    } finally { hook.release(); await pending; peer.release(true); }
});

test('two dependent cleanup workers serialize checkpoints without duplicate counts', async () => {
    await seedCleanupItems(db, { count: 1 }); await seedDependents(1, 200); const job = await prune();
    const first = await getPool().connect(), second = await getPool().connect(); let right;
    const hook = checkpoint(first, sql => sql.startsWith('INSERT INTO scoped_repair_lab.cleanup_item_claims'));
    const left = stepDependentCleanup(hook.db, job.id).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true); const pid = (await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        right = stepDependentCleanup(second, job.id).then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(db, pid); hook.release();
        expect((await left).value.dependents_deleted).toBe(128); expect((await right).value.dependents_deleted).toBe(256);
        expect((await drain(db, await readCleanupJob(db, job.id))).dependents_deleted).toBe(400);
    } finally { hook.release(); await left; if (right) await right; first.release(); second.release(); }
});
