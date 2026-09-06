/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { installPageRepairPrototype } from '../libraryPageRepair/schema.mjs';
import { seedPageRepairFixture, pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME } from '../libraryPageRepair/fixture.mjs';
import { visitPageRepair } from '../libraryPageRepair/visit.mjs';
import { readRepairOccupancy } from './occupancy.mjs';
import { measureRepairContention, measureRepairLockTimeout, measureRepairTruncateOrder } from './concurrency.mjs';
import { measureRepairStorage, measureRepairBulkChanges } from './storage.mjs';
import { measureRepairReconnect } from './reconnect.mjs';

export async function runRepairLifecycleAssessment(db, { withClient }) {
    let installed = false, report;
    await db.query('BEGIN');
    try {
        await installPageRepairPrototype(db, 'disposable');
        await db.query(`CREATE TABLE page_repair_lab.page_repair_catalog(id integer PRIMARY KEY,is_active boolean);
            INSERT INTO page_repair_lab.page_repair_catalog SELECT n,true FROM generate_series(1,4) n`);
        await db.query('COMMIT'); installed = true;
        await seedPageRepairFixture(db, 'disposable', 20001);
        await db.query(`INSERT INTO page_repair_lab.page_repair_source(id,library_id) VALUES(100002,2),(500001,3),(520001,3);
            INSERT INTO page_repair_lab.page_repair_source(id,library_id) SELECT 800001+n*20000,4 FROM generate_series(0,256) n`);
        const occupancy = await readRepairOccupancy(db, 'prototype');
        const bulkChanges = await measureRepairBulkChanges(db);
        // Establish a committed baseline after bulk generation invalidation.
        const visit = () => visitPageRepair(pageRepairClock(db, PAGE_REPAIR_BENCHMARK_TIME), { scope: 'disposable', libraryId: 1 });
        await visit(); await visit();
        const contention = await withClient(reader => withClient(writer => measureRepairContention(db, reader, writer)));
        const lockTimeout = await withClient(reader => withClient(writer => measureRepairLockTimeout(db, reader, writer)));
        const reconnect = await measureRepairReconnect(db, withClient);
        const storage = await measureRepairStorage(db);
        const truncate = await withClient(reader => withClient(writer => measureRepairTruncateOrder(db, reader, writer)));
        report = { contract: 'library.repair.lifecycle-assessment.v1', productionPromotion: false,
            occupancy, bulkChanges, contention, lockTimeout, reconnect, storage, truncate, providerRequests: 0, productionWrites: 0 };
    } finally {
        await db.query('ROLLBACK');
        if (installed) await db.query('DROP SCHEMA page_repair_lab CASCADE');
    }
    const cleaned = (await db.query("SELECT to_regnamespace('page_repair_lab') IS NULL AS clean")).rows[0].clean;
    if (!cleaned) throw new Error('Repair lifecycle cleanup failed');
    return { ...report, cleanupVerified: true };
}
