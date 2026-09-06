/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { installDependentCleanupPrototype } from './schema.mjs';
import { stepDependentCleanup } from './step.mjs';
import { beginInventoryCleanup, appendCleanupManifest, sealCleanupManifest } from '../inventoryCleanup/jobs.mjs';
import { seedCleanupItems, syncCleanupItem } from '../inventoryCleanup/fixtures.mjs';
import { readInventoryDeletionPlan } from '../inventoryDeletionPlan/catalog.mjs';
import { measureRetainedReferences } from '../inventoryRetainedReferences/assessment.mjs';

const mutations = job => ['deleted', 'dependents_deleted', 'history_detached', 'parents_deleted', 'requests_detached', 'feedback_detached']
    .reduce((total, key) => total + Number(job[key]), 0);
async function drain(db, job, budget = 17) {
    let steps = 0, maxMutations = 0;
    while (job.state !== 'completed') {
        if (++steps > 10000) throw new Error('Dependent assessment did not converge');
        const next = await stepDependentCleanup(db, job.id, { budget }), delta = mutations(next) - mutations(job);
        if (delta > budget) throw new Error('Dependent cleanup exceeded shared budget');
        maxMutations = Math.max(maxMutations, delta); job = next;
    }
    return { sourceDeleted: Number(job.deleted), dependentsDeleted: Number(job.dependents_deleted),
        historyDetached: Number(job.history_detached), parentsDeleted: Number(job.parents_deleted), maxMutations, steps };
}
async function measure(db, withClient) {
    await db.query(`INSERT INTO scoped_repair_lab.sync_servers(id) VALUES(1);
        INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id,name) VALUES(1,1,'Original library'),(2,1,'Other library')`);
    await seedCleanupItems(db, { count: 2 });
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_retries(item_id) SELECT 1 FROM generate_series(1,129);
        INSERT INTO scoped_repair_lab.cleanup_previews(item_id) SELECT 1 FROM generate_series(1,193);
        INSERT INTO scoped_repair_lab.cleanup_retries(item_id) SELECT 2 FROM generate_series(1,3);
        INSERT INTO scoped_repair_lab.cleanup_previews(item_id) SELECT 2 FROM generate_series(1,3)`);
    const collecting = await beginInventoryCleanup(db, { kind: 'prune', targetId: 1 });
    await appendCleanupManifest(db, collecting.id, ['fixture-2']);
    let job = await sealCleanupManifest(db, collecting.id, { traversalComplete: true, expectedUniqueCount: 1 });
    job = await stepDependentCleanup(db, job.id);
    if (Number(job.dependents_deleted) !== 128 || Number(job.deleted) !== 0) throw new Error('Dependent first checkpoint mismatch');
    let reservedMoveRejected = false;
    try { await withClient(peer => syncCleanupItem(peer, { libraryId: 2, externalId: 'fixture-1' })); }
    catch (error) { if (error.code !== '55000') throw error; reservedMoveRejected = true; }
    if (!reservedMoveRejected) throw new Error('Reserved source moved during dependent drain');
    const start = performance.now();
    if (await withClient(peer => syncCleanupItem(peer, { libraryId: 2 })) !== 'synced') throw new Error('Unrelated sync failed');
    const unrelatedWriteMs = Number((performance.now() - start).toFixed(2));
    const pruning = await withClient(peer => drain(peer, job));
    if (pruning.sourceDeleted !== 1 || pruning.dependentsDeleted !== 322) throw new Error('Dependent pruning count mismatch');
    await db.query(`INSERT INTO scoped_repair_lab.cleanup_collections(media_server_id,library_id) SELECT 1,1 FROM generate_series(1,257);
        INSERT INTO scoped_repair_lab.cleanup_status(media_server_id,library_id) SELECT 1,1 FROM generate_series(1,129);
        INSERT INTO scoped_repair_lab.cleanup_history(library_id,status,audit) SELECT 1,'completed',jsonb_build_object('sequence',n) FROM generate_series(1,130) n`);
    const digestSql = "SELECT md5(string_agg(audit::text,'|' ORDER BY id)) digest FROM scoped_repair_lab.cleanup_history";
    const before = (await db.query(digestSql)).rows[0].digest;
    const library = await withClient(async peer => drain(peer, await beginInventoryCleanup(peer, { kind: 'library', targetId: 1 })));
    const history = (await db.query(`SELECT count(*)::integer count,bool_and(library_id IS NULL AND status='failed'
        AND library_name='Original library' AND error_message='Library was deleted after this item was classified') preserved FROM scoped_repair_lab.cleanup_history`)).rows[0];
    if (library.dependentsDeleted !== 392 || library.sourceDeleted !== 1 || library.historyDetached !== 130 ||
        history.count !== 130 || !history.preserved || (await db.query(digestSql)).rows[0].digest !== before) throw new Error('Dependent history preservation mismatch');
    const server = await drain(db, await beginInventoryCleanup(db, { kind: 'server', targetId: 1 }));
    return { pruning, library, server, historyRowsRetained: history.count, auditPayloadsPreserved: true,
        reservedMoveRejected, resumedOnNewConnection: true, unrelatedWriteMs };
}

export async function runDependentCleanupMeasurements(db, { withClient }) {
    let installed = false, report;
    await db.query('BEGIN');
    try {
        await installDependentCleanupPrototype(db); await db.query('COMMIT'); installed = true;
        const plan = await readInventoryDeletionPlan(db, ['scoped_repair_lab.sync_servers']);
        report = { contract: 'inventory.dependent-cleanup.benchmark.v2', measurements: await measure(db, withClient),
            retainedReferences: await measureRetainedReferences(db, withClient),
            catalog: { tables: plan.tables.length, edges: plan.edges.length, fingerprint: plan.fingerprint, executable: plan.executable },
            providerRequests: 0, productionWrites: 0, productionPromotion: false };
    } finally { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    if (!(await db.query("SELECT to_regnamespace('scoped_repair_lab') IS NULL clean")).rows[0].clean) throw new Error('Dependent cleanup schema remained');
    return { ...report, cleanupVerified: true };
}
