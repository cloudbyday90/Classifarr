/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME } from '../libraryPageRepair/fixture.mjs';
import { visitPageRepair, visitPageRepairInTransaction } from '../libraryPageRepair/visit.mjs';

/** Observe a real lock dependency with a bounded polling deadline, not an assumed delay. */
export async function waitForRepairBlocking(observer, pid) {
    const deadline = performance.now() + 1500;
    do {
        const row = (await observer.query('SELECT cardinality(pg_blocking_pids($1))>0 AS blocked', [pid])).rows[0];
        if (row.blocked) return;
        await new Promise(resolve => { setTimeout(resolve, 10); });
    } while (performance.now() < deadline);
    throw new Error('Expected repair lock dependency was not observed');
}

const timed = async operation => {
    const start = performance.now();
    try { return { ok: true, value: await operation(), elapsedMs: Number((performance.now() - start).toFixed(2)) }; }
    catch (error) { return { ok: false, code: error?.code ?? null, elapsedMs: Number((performance.now() - start).toFixed(2)) }; }
};

export async function measureRepairContention(observer, reader, writer) {
    const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const results = [];
    for (const libraryId of [1, 2]) {
        let pending;
        try {
            await reader.query('BEGIN');
            const result = await visitPageRepairInTransaction(pageRepairClock(reader, PAGE_REPAIR_BENCHMARK_TIME), { scope: 'disposable', libraryId: 1 });
            if (result.metadataRowsRead > 20000) throw new Error('Repair visit exceeded metadata bound');
            await writer.query("BEGIN; SET LOCAL lock_timeout='2s'");
            pending = timed(() => writer.query(`UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE library_id=$1 AND id=(
                SELECT min(id) FROM page_repair_lab.page_repair_source WHERE library_id=$1)`, [libraryId]));
            await waitForRepairBlocking(observer, pid);
            // Deliberate short hold makes contention visible; it is not normal visit processing time.
            await reader.query('SELECT pg_sleep(0.1)');
            await reader.query('COMMIT');
            const write = await pending;
            if (!write.ok) throw new Error('Repair contention write failed');
            await writer.query('COMMIT');
            results.push({ relationship: libraryId === 1 ? 'same_library' : 'other_library', blockedObserved: true,
                controlledHoldMs: 100, writerElapsedMs: write.elapsedMs });
        } finally {
            await reader.query('ROLLBACK');
            if (pending) await pending;
            await writer.query('ROLLBACK');
        }
    }
    return results;
}

export async function measureRepairLockTimeout(observer, reader, writer) {
    let pending;
    try {
        await reader.query('BEGIN');
        const baseline = await visitPageRepairInTransaction(pageRepairClock(reader, PAGE_REPAIR_BENCHMARK_TIME), { scope: 'disposable', libraryId: 1 });
        await writer.query("BEGIN; SET LOCAL lock_timeout='100ms'");
        const pid = (await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        pending = timed(() => writer.query("UPDATE page_repair_lab.page_repair_source SET metadata='{}' WHERE id=1"));
        await waitForRepairBlocking(observer, pid);
        const result = await pending;
        if (result.code !== '55P03') throw new Error('Repair writer lock timeout was not observed');
        await writer.query('ROLLBACK'); await reader.query('COMMIT');
        const resumed = await visitPageRepair(pageRepairClock(reader, PAGE_REPAIR_BENCHMARK_TIME), { scope: 'disposable', libraryId: 1 });
        if (resumed.status !== 'complete' || resumed.sequence !== baseline.sequence) throw new Error('Timed-out writer changed journal continuity');
        return { postgresCode: result.code, configuredLockTimeoutMs: 100, writerElapsedMs: result.elapsedMs, continuityPreserved: true };
    } finally {
        await reader.query('ROLLBACK'); if (pending) await pending;
        await writer.query('ROLLBACK');
    }
}

/** Demonstrate the old cycle using explicit locks, then exercise the corrected reader. */
export async function measureRepairTruncateOrder(observer, reader, writer) {
    let truncating, reading;
    try {
        await reader.query("BEGIN; SET LOCAL deadlock_timeout='100ms'; SET LOCAL statement_timeout='5s'");
        await reader.query('SELECT * FROM page_repair_lab.page_repair_head FOR UPDATE');
        await writer.query("BEGIN; SET LOCAL deadlock_timeout='100ms'; SET LOCAL statement_timeout='5s'; LOCK TABLE page_repair_lab.page_repair_source IN ACCESS EXCLUSIVE MODE");
        const pid = (await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        truncating = timed(() => writer.query('TRUNCATE page_repair_lab.page_repair_source'));
        await waitForRepairBlocking(observer, pid);
        reading = timed(() => reader.query('SELECT id FROM page_repair_lab.page_repair_source LIMIT 1'));
        const outcomes = await Promise.all([truncating, reading]);
        if (!outcomes.some(item => item.code === '40P01')) throw new Error('Legacy repair lock cycle was not reproduced');
    } finally {
        await reader.query('ROLLBACK'); await writer.query('ROLLBACK');
        if (truncating) await truncating;
        if (reading) await reading;
    }
    let pending;
    try {
        await writer.query('BEGIN; LOCK TABLE page_repair_lab.page_repair_source IN ACCESS EXCLUSIVE MODE');
        const pid = (await reader.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        pending = timed(() => visitPageRepair(pageRepairClock(reader, PAGE_REPAIR_BENCHMARK_TIME), { scope: 'disposable', libraryId: 1 }));
        await waitForRepairBlocking(observer, pid);
        await writer.query('SELECT * FROM page_repair_lab.page_repair_head FOR UPDATE NOWAIT');
        await writer.query('TRUNCATE page_repair_lab.page_repair_source; COMMIT');
        const outcome = await pending;
        if (!outcome.ok || outcome.value.status !== 'restart_required' || outcome.value.counts !== null) throw new Error('Corrected truncate ordering failed');
        return { legacyDeadlockObserved: true, correctedReaderBlockedBeforeHead: true,
            correctedStatus: outcome.value.status, correctedElapsedMs: outcome.elapsedMs };
    } finally {
        await writer.query('ROLLBACK'); if (pending) await pending;
    }
}
