/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { RETAINED_REFERENCES } from './definitions.mjs';
import { beginInventoryCleanup } from '../inventoryCleanup/jobs.mjs';
import { stepDependentCleanup } from '../inventoryDependentCleanup/step.mjs';

const total = job => ['deleted', 'dependents_deleted', 'history_detached', 'parents_deleted', 'requests_detached', 'feedback_detached']
    .reduce((sum, key) => sum + Number(job[key]), 0);
async function drain(db, job, budget) {
    let steps = 0, maxMutations = 0;
    while (job.state !== 'completed') {
        if (++steps > 1000) throw new Error('Retained assessment did not converge');
        const next = await stepDependentCleanup(db, job.id, { budget }), delta = total(next) - total(job);
        if (delta < 0 || delta > budget) throw new Error('Retained cleanup budget mismatch');
        maxMutations = Math.max(maxMutations, delta); job = next;
    }
    return { requestsDetached: Number(job.requests_detached), feedbackDetached: Number(job.feedback_detached),
        parentsDeleted: Number(job.parents_deleted), steps, maxMutations };
}
async function seed(db) {
    await db.query(`INSERT INTO scoped_repair_lab.sync_servers(id) VALUES(10),(11);
        INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id,name) VALUES
            (10,10,'Retained library'),(11,10,'Second library'),(12,11,'Unrelated library');
        INSERT INTO scoped_repair_lab.cleanup_requests(routed_to_library_id) SELECT 12 FROM generate_series(1,8192);
        INSERT INTO scoped_repair_lab.cleanup_feedback(selected_library_id) SELECT 12 FROM generate_series(1,8192);
        INSERT INTO scoped_repair_lab.cleanup_requests(routed_to_library_id,routed_to_library_name,request_status,audit)
            SELECT 10,CASE WHEN n%2=0 THEN 'Earlier name' END,'available',jsonb_build_object('sequence',n) FROM generate_series(1,257) n;
        INSERT INTO scoped_repair_lab.cleanup_feedback(selected_library_id,selected_policy_id,top_suggestion_library_id,was_correction,audit)
            SELECT 10,25,11,n%2=0,jsonb_build_object('sequence',n,'scores',jsonb_build_array(40,60)) FROM generate_series(1,129) n;
        INSERT INTO scoped_repair_lab.cleanup_requests(routed_to_library_id) SELECT 11 FROM generate_series(1,3);
        INSERT INTO scoped_repair_lab.cleanup_feedback(selected_library_id) SELECT 11 FROM generate_series(1,3);
        ANALYZE scoped_repair_lab.cleanup_requests; ANALYZE scoped_repair_lab.cleanup_feedback;`);
}
async function evidence(db) {
    const result = {};
    for (const { table, column } of RETAINED_REFERENCES) {
        result[table] = (await db.query(`SELECT count(*)::integer rows,
            encode(sha256(convert_to(string_agg((to_jsonb(r)-ARRAY['${column}','library_snapshot'])::text,'|' ORDER BY id),'UTF8')),'hex') digest
            FROM scoped_repair_lab.${table} r`)).rows[0];
    }
    return result;
}
async function indexPlans(db) {
    const plans = {};
    for (const { table, column } of RETAINED_REFERENCES) {
        const result = (await db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT r.id,r.${column} library_id
            FROM scoped_repair_lab.${table} r JOIN scoped_repair_lab.sync_libraries l ON l.id=r.${column}
            WHERE l.id=$1 ORDER BY r.id LIMIT $2`, [10, 128])).rows[0]['QUERY PLAN'][0];
        const indexes = [];
        const visit = node => { if (node['Index Name']) indexes.push(node['Index Name']); for (const child of node.Plans ?? []) visit(child); };
        visit(result.Plan);
        plans[table] = { returnedRows: result.Plan['Actual Rows'], indexes, executionMs: result['Execution Time'],
            sharedHitBlocks: result.Plan['Shared Hit Blocks'], sharedReadBlocks: result.Plan['Shared Read Blocks'] };
    }
    return plans;
}

export async function measureRetainedReferences(db, withClient) {
    await seed(db);
    const before = await evidence(db), plans = await indexPlans(db);
    const initial = await beginInventoryCleanup(db, { kind: 'library', targetId: 10 });
    const checkpoint = await stepDependentCleanup(db, initial.id, { budget: 17 });
    if (Number(checkpoint.requests_detached) !== 17 || total(checkpoint) !== 17) throw new Error('Retained checkpoint mismatch');
    const library = await withClient(peer => drain(peer, checkpoint, 17));
    const server = await withClient(async peer => drain(peer, await beginInventoryCleanup(peer, { kind: 'server', targetId: 10 }), 1));
    const after = await evidence(db);
    if (JSON.stringify(before) !== JSON.stringify(after) || library.requestsDetached !== 257 || library.feedbackDetached !== 129 ||
        server.requestsDetached !== 3 || server.feedbackDetached !== 3) throw new Error('Retained evidence changed');
    for (const { table, column } of RETAINED_REFERENCES) {
        const check = (await db.query(`SELECT count(*) FILTER(WHERE ${column}=12 AND library_snapshot IS NULL)::integer unrelated,
            bool_and(CASE WHEN ${column} IS NULL THEN library_snapshot IS NOT NULL
                AND (library_snapshot->>'libraryId')::integer IN (10,11)
                AND library_snapshot->>'nameAtDetachment' IN ('Retained library','Second library') ELSE true END) snapshots_valid
            FROM scoped_repair_lab.${table}`)).rows[0];
        if (check.unrelated !== 8192 || !check.snapshots_valid) throw new Error('Retained scope or snapshot mismatch');
    }
    return { library, server, retainedRows: Object.values(after).reduce((sum, row) => sum + row.rows, 0),
        detachedRows: 392, unrelatedRowsPreserved: 16384, allNonReferenceFieldsPreserved: true,
        resumedOnNewConnection: true, indexPlans: plans };
}
