/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installDependentCleanupPrototype } from '../../scripts/inventoryDependentCleanup/schema.mjs';
import { stepDependentCleanup } from '../../scripts/inventoryDependentCleanup/step.mjs';
import { beginInventoryCleanup, appendCleanupManifest, sealCleanupManifest, readCleanupJob } from '../../scripts/inventoryCleanup/jobs.mjs';
import { CLEANUP_LOCK_NAMESPACE } from '../../scripts/inventoryCleanup/contract.mjs';
import { RETAINED_REFERENCES } from '../../scripts/inventoryRetainedReferences/definitions.mjs';
import { waitForRepairBlocking } from '../../scripts/libraryRepairAssessment/concurrency.mjs';

let db, installed;
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN'); await installDependentCleanupPrototype(db); await db.query('COMMIT'); installed = true;
    await db.query(`INSERT INTO scoped_repair_lab.sync_servers(id) VALUES(1),(2);
        INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id,name) VALUES(1,1,'Name at removal'),(2,1,'Other library'),(3,2,'Other server');
        INSERT INTO scoped_repair_lab.cleanup_history(library_id,status,audit) VALUES(1,'completed','{"decision":1}')`);
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    finally { db.release(); }
});
const total = job => ['deleted', 'parents_deleted', 'dependents_deleted', 'history_detached', 'requests_detached', 'feedback_detached']
    .reduce((sum, key) => sum + Number(job[key]), 0);
async function drain(client, job, budget = 17) {
    let steps = 0;
    while (job.state !== 'completed') {
        if (++steps > 2000) throw new Error('Retained fixture did not converge');
        const next = await stepDependentCleanup(client, job.id, { budget });
        expect(total(next) - total(job)).toBeLessThanOrEqual(budget); job = next;
    }
    return job;
}
async function seed(count = 3) {
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_requests(routed_to_library_id,routed_to_library_name,classification_id,request_status,audit)
        SELECT 1,(ARRAY['Original name','',NULL])[1+n%3],1,(ARRAY['pending','approved','available'])[1+n%3],
            jsonb_build_object('sequence',n,'requester','private fixture') FROM generate_series(1,$1::integer) n`, [count]);
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_feedback(selected_library_id,selected_policy_id,top_suggestion_library_id,was_correction,audit)
        SELECT 1,100,2,n%2=0,jsonb_build_object('sequence',n,'scores',jsonb_build_array(10,90),'reason','fixture',
            'respondedAt','2026-08-01') FROM generate_series(1,$1::integer) n`, [count]);
}
async function rows(client = db) {
    return Promise.all(RETAINED_REFERENCES.map(async ({ table }) => (await client.query(`SELECT * FROM scoped_repair_lab.${table} ORDER BY id`)).rows));
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

test.each([1, 17, 128])('library removal preserves request/feedback evidence and shares a %i-row mutation budget', async budget => {
    await seed(129); const before = await rows();
    await db.query('INSERT INTO scoped_repair_lab.cleanup_collections(media_server_id,library_id) VALUES(1,1)');
    let job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    job = await stepDependentCleanup(db, job.id, { budget }); expect(total(job)).toBeLessThanOrEqual(budget);
    const peer = await getPool().connect();
    try { job = await drain(peer, job, budget); } finally { peer.release(); }
    expect(job).toMatchObject({ requests_detached: 129, feedback_detached: 129, history_detached: 1, dependents_deleted: 1, parents_deleted: 1 });
    const after = await rows();
    for (const [index, { column }] of RETAINED_REFERENCES.entries()) {
        expect(after[index]).toHaveLength(before[index].length);
        after[index].forEach((row, offset) => {
            expect(row).toEqual({ ...before[index][offset], [column]: null, library_snapshot: expect.objectContaining({
                libraryId: 1, mediaServerId: 1, nameAtDetachment: 'Name at removal', cleanupJobId: job.id, detachedAt: expect.any(String) }) });
        });
    }
    expect((await db.query('SELECT id FROM scoped_repair_lab.cleanup_history')).rows).toEqual([{ id: 1 }]);
    expect(await stepDependentCleanup(db, job.id)).toEqual(job);
    expect(await rows()).toEqual(after);
});

test('server removal includes multiple libraries and preserves null and unrelated references', async () => {
    await seed();
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_requests(routed_to_library_id) VALUES(2),(3),(NULL);
        INSERT INTO scoped_repair_lab.cleanup_feedback(selected_library_id) VALUES(2),(3),(NULL)`);
    const job = await drain(db, await beginInventoryCleanup(db, { kind: 'server', targetId: 1 }), 1);
    expect(job).toMatchObject({ requests_detached: 4, feedback_detached: 4, parents_deleted: 3 });
    for (const [index, { column }] of RETAINED_REFERENCES.entries()) {
        const result = (await rows())[index];
        expect(result[3].library_snapshot).toMatchObject({ libraryId: 2, nameAtDetachment: 'Other library' });
        expect(result[4]).toMatchObject({ [column]: 3, library_snapshot: null });
        expect(result[5]).toMatchObject({ [column]: null, library_snapshot: null });
    }
});

test('pruning does not detach library references or rewrite retained evidence', async () => {
    await seed(); const before = await rows(); const job = await beginInventoryCleanup(db, { kind: 'prune', targetId: 1 });
    await appendCleanupManifest(db, job.id, []);
    const sealed = await sealCleanupManifest(db, job.id, { traversalComplete: true, expectedUniqueCount: 0 });
    expect(await drain(db, sealed)).toMatchObject({ requests_detached: 0, feedback_detached: 0 });
    expect(await rows()).toEqual(before);
});

test.each(RETAINED_REFERENCES)('$table permits moves before fencing and rejects moves/edits or new references after fencing', async ({ table, column }) => {
    await seed(); await db.query(`UPDATE scoped_repair_lab.${table} SET ${column}=2 WHERE id=1`);
    const moved = (await db.query(`SELECT * FROM scoped_repair_lab.${table} WHERE id=1`)).rows[0];
    const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    await expect(db.query(`UPDATE scoped_repair_lab.${table} SET ${column}=2 WHERE id=2`)).rejects.toMatchObject({ code: '55000' });
    await expect(db.query(`UPDATE scoped_repair_lab.${table} SET audit='{}' WHERE id=2`)).rejects.toMatchObject({ code: '55000' });
    await expect(db.query(`INSERT INTO scoped_repair_lab.${table}(${column}) VALUES(1)`)).rejects.toMatchObject({ code: '55000' });
    await expect(db.query(`UPDATE scoped_repair_lab.${table} SET ${column}=1 WHERE id=1`)).rejects.toMatchObject({ code: '55000' });
    await drain(db, job);
    expect((await db.query(`SELECT * FROM scoped_repair_lab.${table} WHERE id=1`)).rows[0]).toEqual(moved);
});

test.each(RETAINED_REFERENCES)('$table blocks forged snapshots, silent detachment, deletion and reattachment after ID reuse', async ({ table, column }) => {
    await seed();
    await expect(db.query(`INSERT INTO scoped_repair_lab.${table}(${column},library_snapshot) VALUES(1,'{}')`)).rejects.toMatchObject({ code: '55000' });
    await expect(db.query(`UPDATE scoped_repair_lab.${table} SET ${column}=NULL`)).rejects.toMatchObject({ code: '55000' });
    await expect(db.query(`DELETE FROM scoped_repair_lab.${table}`)).rejects.toMatchObject({ code: '55000' });
    await drain(db, await beginInventoryCleanup(db, { kind: 'library', targetId: 1 }));
    await db.query("INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id,name) VALUES(1,1,'Replacement library')");
    await expect(db.query(`UPDATE scoped_repair_lab.${table} SET ${column}=1 WHERE id=1`)).rejects.toMatchObject({ code: '55000' });
    await expect(db.query(`UPDATE scoped_repair_lab.${table} SET library_snapshot='{}' WHERE id=1`)).rejects.toMatchObject({ code: '55000' });
    expect((await db.query(`SELECT library_snapshot FROM scoped_repair_lab.${table} WHERE id=1`)).rows[0].library_snapshot.nameAtDetachment).toBe('Name at removal');
});

test.each(RETAINED_REFERENCES)('$table rejects payload changes even while the cleanup lock is held', async ({ table, column }) => {
    await seed(); const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    await db.query('BEGIN');
    try {
        await db.query('SELECT pg_advisory_xact_lock($1,1)', [CLEANUP_LOCK_NAMESPACE]);
        await expect(db.query(`UPDATE scoped_repair_lab.${table} SET ${column}=NULL,
            library_snapshot=scoped_repair_lab.retained_library_snapshot(${column},$1),audit='{}' WHERE id=1`, [job.id]))
            .rejects.toMatchObject({ code: '55000' });
    } finally { await db.query('ROLLBACK'); }
    expect(await readCleanupJob(db, job.id)).toMatchObject({ requests_detached: 0, feedback_detached: 0 });
});

test.each(["request_status='failed'", "routed_to_library_name='Replacement'", 'classification_id=NULL'])(
    'request detachment rejects changing independent evidence: %s', async change => {
        await seed(); const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
        await db.query('BEGIN');
        try {
            await db.query('SELECT pg_advisory_xact_lock($1,1)', [CLEANUP_LOCK_NAMESPACE]);
            await expect(db.query(`UPDATE scoped_repair_lab.cleanup_requests SET routed_to_library_id=NULL,
                library_snapshot=scoped_repair_lab.retained_library_snapshot(routed_to_library_id,$1),${change} WHERE id=1`, [job.id]))
                .rejects.toMatchObject({ code: '55000' });
        } finally { await db.query('ROLLBACK'); }
    });

test('a cleanup job cannot authorize detachment from another library on the same server', async () => {
    await db.query('INSERT INTO scoped_repair_lab.cleanup_feedback(selected_library_id) VALUES(2)');
    const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    await db.query('BEGIN');
    try {
        await db.query('SELECT pg_advisory_xact_lock($1,1)', [CLEANUP_LOCK_NAMESPACE]);
        await expect(db.query(`UPDATE scoped_repair_lab.cleanup_feedback SET selected_library_id=NULL,
            library_snapshot=scoped_repair_lab.retained_library_snapshot(selected_library_id,$1)`, [job.id]))
            .rejects.toMatchObject({ code: '55000' });
    } finally { await db.query('ROLLBACK'); }
});

test('a request status update remains possible after detachment without replacing provenance', async () => {
    await seed(); await drain(db, await beginInventoryCleanup(db, { kind: 'library', targetId: 1 }));
    const before = (await rows())[0][0];
    await db.query("UPDATE scoped_repair_lab.cleanup_requests SET request_status='available' WHERE id=1");
    expect((await rows())[0][0]).toEqual({ ...before, request_status: 'available' });
});

test.each(RETAINED_REFERENCES)('$table detachment and counters roll back together on checkpoint failure', async ({ table, column, counter }) => {
    await seed(); const before = await rows(); const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    const faulty = { query: (sql, values) => sql.startsWith(`UPDATE scoped_repair_lab.cleanup_jobs SET ${counter}=`)
        ? Promise.reject(new Error('checkpoint interrupted')) : db.query(sql, values) };
    await expect(stepDependentCleanup(faulty, job.id)).rejects.toThrow('checkpoint interrupted');
    expect(await rows()).toEqual(before); expect(await readCleanupJob(db, job.id)).toMatchObject({ requests_detached: 0, feedback_detached: 0, history_detached: 0 });
    await drain(db, job); expect((await db.query(`SELECT ${column} FROM scoped_repair_lab.${table} WHERE id=1`)).rows[0][column]).toBeNull();
});

test.each(RETAINED_REFERENCES)('$table admission holds a real parent lock and forces fencing to retry', async ({ table, column }) => {
    const peer = await getPool().connect();
    try {
        await peer.query('BEGIN'); await peer.query(`INSERT INTO scoped_repair_lab.${table}(${column}) VALUES(1)`);
        await expect(beginInventoryCleanup(db, { kind: 'library', targetId: 1 })).rejects.toMatchObject({ code: '55P03' });
        expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.cleanup_jobs')).rows[0].n).toBe(0);
        await peer.query('COMMIT'); await drain(db, await beginInventoryCleanup(db, { kind: 'library', targetId: 1 }));
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});

test('in-flight fencing rejects a late reference without waiting or admitting it after commit', async () => {
    const peer = await getPool().connect();
    const hook = checkpoint(peer, sql => sql.startsWith('UPDATE scoped_repair_lab.sync_libraries SET cleanup_job='));
    const pending = beginInventoryCleanup(hook.db, { kind: 'library', targetId: 1 }).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true);
        await expect(db.query('INSERT INTO scoped_repair_lab.cleanup_requests(routed_to_library_id) VALUES(1)')).rejects.toMatchObject({ code: '55P03' });
        hook.release(); expect((await pending).error).toBeUndefined();
        await expect(db.query('INSERT INTO scoped_repair_lab.cleanup_feedback(selected_library_id) VALUES(1)')).rejects.toMatchObject({ code: '55000' });
    } finally { hook.release(); await pending; peer.release(); }
});

test('backend termination rolls back an uncommitted snapshot and resumes from committed progress', async () => {
    await seed(); let job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    job = await stepDependentCleanup(db, job.id, { budget: 2 });
    expect(job).toMatchObject({ history_detached: 1, requests_detached: 1 }); const before = await rows();
    const peer = await getPool().connect(); peer.on('error', () => {});
    const pid = (await peer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    const hook = checkpoint(peer, sql => sql.startsWith('UPDATE scoped_repair_lab.cleanup_requests r SET'));
    const pending = stepDependentCleanup(hook.db, job.id).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true); await db.query('SELECT pg_terminate_backend($1)', [pid]); hook.release();
        expect((await pending).error).toBeDefined(); expect(await rows()).toEqual(before);
        expect(await readCleanupJob(db, job.id)).toMatchObject({ requests_detached: 1, feedback_detached: 0 });
        const resumed = await getPool().connect();
        try { expect(await drain(resumed, job)).toMatchObject({ requests_detached: 3, feedback_detached: 3 }); } finally { resumed.release(); }
    } finally { hook.release(); await pending; peer.release(true); }
});

test('two retained cleanup workers serialize counters without duplicate detachment', async () => {
    await seed(); const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    const first = await getPool().connect(), second = await getPool().connect(); let right;
    const hook = checkpoint(first, sql => sql.startsWith('UPDATE scoped_repair_lab.cleanup_requests r SET'));
    const left = stepDependentCleanup(hook.db, job.id, { budget: 2 }).then(value => ({ value }), error => { hook.fail(); return { error }; });
    try {
        expect(await hook.ready).toBe(true); const pid = (await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        right = stepDependentCleanup(second, job.id, { budget: 2 }).then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(db, pid); hook.release();
        expect((await left).value.requests_detached).toBe(1); expect((await right).value.requests_detached).toBe(3);
        expect(await drain(db, await readCleanupJob(db, job.id))).toMatchObject({ requests_detached: 3, feedback_detached: 3 });
    } finally { hook.release(); await left; if (right) await right; first.release(); second.release(); }
});

test.each([
    'ALTER TABLE scoped_repair_lab.cleanup_feedback ADD COLUMN unexpected text',
    'ALTER TABLE scoped_repair_lab.cleanup_requests DISABLE TRIGGER retained_admit',
])('retained schema drift stops all cleanup before mutations: %s', async ddl => {
    await seed(); const before = await rows(); const job = await beginInventoryCleanup(db, { kind: 'library', targetId: 1 });
    await db.query(ddl); await expect(stepDependentCleanup(db, job.id)).rejects.toThrow('schema contract changed');
    const after = await rows(); after[1].forEach(row => { delete row.unexpected; }); expect(after).toEqual(before);
    expect(await readCleanupJob(db, job.id)).toMatchObject({ requests_detached: 0, feedback_detached: 0, history_detached: 0 });
});
