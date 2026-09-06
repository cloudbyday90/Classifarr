/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME } from '../libraryPageRepair/fixture.mjs';
import { visitPageRepair, visitPageRepairInTransaction } from '../libraryPageRepair/visit.mjs';

const options = { scope: 'disposable', libraryId: 3 };
const clock = db => pageRepairClock(db, PAGE_REPAIR_BENCHMARK_TIME);

/** Terminates only a backend supplied by the disposable runtime's scoped connection factory. */
export async function measureRepairReconnect(observer, withClient) {
    const first = await withClient(db => visitPageRepair(clock(db), options));
    if (first.status !== 'in_progress') throw new Error('Reconnect fixture must span two ranges');
    const before = (await observer.query('SELECT cursor_page FROM page_repair_lab.page_repair_state WHERE library_id=3')).rows[0].cursor_page;
    await withClient(async victim => {
        let resolveDisconnect, timer;
        const disconnected = new Promise(resolve => { resolveDisconnect = resolve; });
        const onError = error => { resolveDisconnect(error); };
        victim.on('error', onError);
        try {
            await victim.query('BEGIN');
            const pending = await visitPageRepairInTransaction(clock(victim), options);
            if (pending.status !== 'complete') throw new Error('Interrupted visit did not reach an uncommitted summary');
            const pid = (await victim.query('SELECT pg_backend_pid() pid')).rows[0].pid;
            const stopped = (await observer.query('SELECT pg_terminate_backend($1) stopped', [pid])).rows[0].stopped;
            if (!stopped) throw new Error('Owned repair backend was not terminated');
            const error = await Promise.race([disconnected, new Promise(resolve => { timer = setTimeout(() => resolve(null), 2000); })]);
            if (error?.code !== '57P01') throw new Error('Owned repair backend termination was not observed');
        } finally { clearTimeout(timer); }
    });
    const after = (await observer.query('SELECT cursor_page FROM page_repair_lab.page_repair_state WHERE library_id=3')).rows[0].cursor_page;
    if (before !== after) throw new Error('Interrupted repair cursor committed unexpectedly');
    const resumed = await withClient(db => visitPageRepair(clock(db), options));
    if (resumed.status !== 'complete' || resumed.counts.inventory !== 2 || resumed.metadataRowsRead !== 1) throw new Error('Repair reconnect failed to resume');
    return { committedCursorSurvivedReconnect: true, terminatedVisitRolledBack: true,
        resumedStatus: resumed.status, resumedMetadataRows: resumed.metadataRowsRead, databaseCrashTested: false };
}
