/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { installInventoryCleanupPrototype } from './schema.mjs';
import { beginInventoryCleanup, appendCleanupManifest, sealCleanupManifest } from './jobs.mjs';
import { stepInventoryCleanup } from './step.mjs';
import { seedCleanupItems, syncCleanupItem, drainCleanup } from './fixtures.mjs';

async function measurePruning(db, withClient) {
    await seedCleanupItems(db, { count: 2049 });
    let job = await beginInventoryCleanup(db, { kind: 'prune', targetId: 1 });
    await appendCleanupManifest(db, job.id, Array.from({ length: 128 }, (_, i) => `fixture-${i + 1}`));
    await appendCleanupManifest(db, job.id, Array.from({ length: 9 }, (_, i) => `fixture-${i + 129}`));
    job = await sealCleanupManifest(db, job.id, { traversalComplete: true, expectedUniqueCount: 137 });
    job = await stepInventoryCleanup(db, job.id);
    if (job.state !== 'running' || Number(job.deleted) !== 128) throw new Error('Partial cleanup was called complete');
    const start = performance.now();
    if (await withClient(peer => syncCleanupItem(peer, { libraryId: 2 })) !== 'synced') throw new Error('Unrelated sync failed');
    const unrelatedWriteMs = Number((performance.now() - start).toFixed(2));
    const result = await withClient(peer => drainCleanup(peer, job));
    const remaining = (await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.scoped_repair_source WHERE library_id=1')).rows[0].n;
    if (remaining !== 137 || Number(result.job.deleted) !== 1912) throw new Error('Pruning exact-count oracle mismatch');
    return { initial: 2049, retained: remaining, deleted: Number(result.job.deleted), resumedOnNewConnection: true,
        maxSourceDeletes: result.maxSourceDeletes, unrelatedWriteMs, completed: result.job.state === 'completed' };
}

async function measureParentRemoval(db, withClient) {
    await seedCleanupItems(db, { libraryId: 3, count: 2051, prefix: 'parent-' });
    const library = await drainCleanup(db, await beginInventoryCleanup(db, { kind: 'library', targetId: 3 }));
    if (Number(library.job.deleted) !== 2051 || Number(library.job.parents_deleted) !== 1) throw new Error('Library drain count mismatch');
    await seedCleanupItems(db, { libraryId: null, count: 257, prefix: 'unassigned-' });
    const serverJob = await beginInventoryCleanup(db, { kind: 'server', targetId: 1 });
    let admissionRejected = false;
    try { await withClient(peer => syncCleanupItem(peer)); }
    catch (error) { if (error.code !== '55000') throw error; admissionRejected = true; }
    if (!admissionRejected) throw new Error('Server drain admitted a late source write');
    const server = await withClient(peer => drainCleanup(peer, serverJob));
    const left = (await db.query(`SELECT (SELECT count(*) FROM scoped_repair_lab.scoped_repair_source) items,
        (SELECT count(*) FROM scoped_repair_lab.sync_libraries) libraries,(SELECT count(*) FROM scoped_repair_lab.sync_servers) servers`)).rows[0];
    if (Object.values(left).some(value => Number(value) !== 0)) throw new Error('Parent drain left child rows');
    return { libraryDeletedItems: Number(library.job.deleted), serverDeletedItems: Number(server.job.deleted),
        serverDeletedParents: Number(server.job.parents_deleted), maxSourceDeletes: Math.max(library.maxSourceDeletes, server.maxSourceDeletes),
        maxParentDeletes: Math.max(library.maxParentDeletes, server.maxParentDeletes), lateInsertRejected: admissionRejected, finalCounts: left };
}

export async function runInventoryCleanupMeasurements(db, { withClient }) {
    let installed = false, report;
    await db.query('BEGIN');
    try {
        await installInventoryCleanupPrototype(db); await db.query('COMMIT'); installed = true;
        await db.query(`INSERT INTO scoped_repair_lab.sync_servers(id) VALUES(1);
            INSERT INTO scoped_repair_lab.sync_libraries(id,media_server_id) VALUES(1,1),(2,1),(3,1)`);
        report = { contract: 'inventory.bounded-cleanup.benchmark.v1', pruning: await measurePruning(db, withClient),
            parents: await measureParentRemoval(db, withClient), productionPromotion: false, providerRequests: 0, productionWrites: 0 };
    } finally { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    if (!(await db.query("SELECT to_regnamespace('scoped_repair_lab') IS NULL clean")).rows[0].clean) throw new Error('Cleanup benchmark schema removal failed');
    return { ...report, cleanupVerified: true };
}
