/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { installScopedRepairPrototype } from '../../scripts/libraryScopedRepair/schema.mjs';
import { seedScopedFixture } from '../../scripts/libraryScopedRepair/fixture.mjs';
import { visitScopedRepair, visitScopedRepairInTransaction } from '../../scripts/libraryScopedRepair/visit.mjs';
import { lockScopedRepairLibraries } from '../../scripts/libraryScopedRepair/locking.mjs';
import { mutateScopedRepair } from '../../scripts/libraryScopedRepair/mutation.mjs';
import { measureScopedConcurrency } from '../../scripts/libraryScopedRepair/concurrency.mjs';
import { waitForRepairBlocking } from '../../scripts/libraryRepairAssessment/concurrency.mjs';
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME as now } from '../../scripts/libraryPageRepair/fixture.mjs';

let db, installed;
beforeEach(async () => {
    db = await getPool().connect(); installed = false;
    await db.query('BEGIN'); await installScopedRepairPrototype(db, 'disposable');
    await db.query('COMMIT'); installed = true;
});
afterEach(async () => {
    try { await db.query('ROLLBACK'); if (installed) await db.query('DROP SCHEMA scoped_repair_lab CASCADE'); }
    finally { db.release(); }
});
const visit = (libraryId = 1, time = now) => visitScopedRepair(pageRepairClock(db, time), { scope: 'disposable', libraryId });

test('unrelated writers commit during a reader; same-library writes and opposite moves serialize', async () => {
    await seedScopedFixture(db, { rows: 1 }); await seedScopedFixture(db, { rows: 1, libraryId: 2, offset: 1 });
    const reader = await getPool().connect(), writer = await getPool().connect();
    try {
        expect(await measureScopedConcurrency(db, reader, writer)).toMatchObject({ otherLibraryCommittedWhileReaderHeld: true,
            sameLibraryBlockedObserved: true, oppositeMoveBlockedBeforeWrite: true, oppositeMovesCommitted: true });
    } finally { reader.release(); writer.release(); }
});

test('global registry capacity fails closed then reclaims idle libraries automatically', async () => {
    for (let id = 1; id <= 32; id++) await visit(id);
    expect(await visit(33)).toMatchObject({ counts: null, reason: 'library_capacity_busy_or_full' });
    await visit(32, now + 6 * 86400000);
    expect(await visit(33, now + 8 * 86400000)).toMatchObject({ status: 'complete' });
    expect((await db.query('SELECT library_id FROM scoped_repair_lab.scoped_repair_heads WHERE library_id IS NOT NULL ORDER BY library_id')).rows)
        .toEqual([{ library_id: 32 }, { library_id: 33 }]);
});

test('idle reclamation skips an actively locked library without blocking the selected library', async () => {
    await seedScopedFixture(db, { rows: 1 }); await visit();
    const peer = await getPool().connect();
    try {
        await peer.query('BEGIN'); await lockScopedRepairLibraries(peer, 'disposable', [1], 'read');
        expect(await visit(2, now + 8 * 86400000)).toMatchObject({ status: 'complete' });
        expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.scoped_repair_pages WHERE owner IS NOT NULL')).rows[0].n).toBe(1);
        await peer.query('COMMIT');
        await visit(3, now + 8 * 86400000);
        expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.scoped_repair_pages WHERE owner IS NOT NULL')).rows[0].n).toBe(0);
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});

test('busy free summary slots refuse publication, then retry after the holder releases them', async () => {
    await seedScopedFixture(db, { rows: 1 });
    const peer = await getPool().connect();
    try {
        await peer.query('BEGIN; SELECT slot FROM scoped_repair_lab.scoped_repair_pages FOR UPDATE');
        expect(await visit()).toMatchObject({ counts: null, reason: 'page_capacity_busy_or_full', metadataRowsRead: 0, lookaheadRowsRead: 1 });
        await peer.query('COMMIT');
        expect(await visit()).toMatchObject({ status: 'complete', counts: { inventory: 1 } });
        expect((await db.query('SELECT count(*)::integer n FROM scoped_repair_lab.scoped_repair_pages')).rows[0].n).toBe(128);
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});

test('simultaneous first visits allocate distinct registry and summary slots', async () => {
    await seedScopedFixture(db, { rows: 1 }); await seedScopedFixture(db, { rows: 1, libraryId: 2, offset: 1 });
    const peer = await getPool().connect();
    try {
        await peer.query('BEGIN');
        const held = await visitScopedRepairInTransaction(pageRepairClock(peer, now), { scope: 'disposable', libraryId: 1 });
        expect(held.status).toBe('complete');
        expect(await visit(2)).toMatchObject({ status: 'complete', counts: { inventory: 1 } });
        await peer.query('COMMIT');
        expect((await db.query('SELECT count(DISTINCT owner)::integer n FROM scoped_repair_lab.scoped_repair_pages WHERE owner IS NOT NULL')).rows[0].n).toBe(2);
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});

test('a reader waiting for truncate has not taken its library advisory lock', async () => {
    await seedScopedFixture(db, { rows: 1 }); await visit();
    const peer = await getPool().connect(); let pending;
    try {
        await peer.query('BEGIN; LOCK TABLE scoped_repair_lab.scoped_repair_source IN ACCESS EXCLUSIVE MODE');
        const pid = (await db.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        pending = visit().then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(getPool(), pid);
        expect((await peer.query("SELECT count(*)::integer n FROM pg_locks WHERE pid=$1 AND locktype='advisory'", [pid])).rows[0].n).toBe(0);
        await peer.query('TRUNCATE scoped_repair_lab.scoped_repair_source; COMMIT');
        expect((await pending).value).toMatchObject({ counts: null, reason: 'unsupported_change' });
    } finally { await peer.query('ROLLBACK'); if (pending) await pending; peer.release(); }
});

test('rolled-back source writes and page repairs preserve the committed cache on another connection', async () => {
    await seedScopedFixture(db, { rows: 20001 }); const initial = await visit();
    const peer = await getPool().connect();
    try {
        await peer.query('BEGIN'); await lockScopedRepairLibraries(peer, 'disposable', [1], 'write');
        await peer.query('DELETE FROM scoped_repair_lab.scoped_repair_source WHERE id=1');
        await visitScopedRepairInTransaction(pageRepairClock(peer, now), { scope: 'disposable', libraryId: 1 });
        await peer.query('ROLLBACK');
        const resumed = await visit();
        expect(resumed).toMatchObject({ status: 'complete', metadataRowsRead: 1, counts: { inventory: 20001 }, epoch: initial.epoch, revision: '0' });
    } finally { await peer.query('ROLLBACK'); peer.release(); }
});

test('disconnecting an owned backend rolls back its unpublished page and reconnect resumes the committed cursor', async () => {
    await seedScopedFixture(db, { rows: 20001 }); const initial = await visit();
    const victim = await getPool().connect(); let timer;
    let onDisconnect;
    const disconnected = new Promise(resolve => { onDisconnect = resolve; });
    victim.on('error', onDisconnect);
    try {
        await victim.query('BEGIN');
        expect(await visitScopedRepairInTransaction(pageRepairClock(victim, now), { scope: 'disposable', libraryId: 1 }))
            .toMatchObject({ status: 'complete', metadataRowsRead: 1 });
        const pid = (await victim.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        expect((await db.query('SELECT pg_terminate_backend($1) stopped', [pid])).rows[0].stopped).toBe(true);
        const error = await Promise.race([disconnected, new Promise(resolve => { timer = setTimeout(() => resolve(null), 2000); })]);
        expect(error?.code).toBe('57P01');
    } finally { clearTimeout(timer); victim.release(true); }
    expect(await visit()).toMatchObject({ status: 'complete', epoch: initial.epoch, revision: '0', metadataRowsRead: 1, counts: { inventory: 20001 } });
});

test('opposite moves started between library lock acquisitions cannot form a lock cycle', async () => {
    await seedScopedFixture(db, { rows: 1 }); await seedScopedFixture(db, { rows: 1, libraryId: 2, offset: 1 });
    const first = await getPool().connect(), second = await getPool().connect();
    let releaseGate, signalReady, firstLock = false, left, right;
    const gate = new Promise(resolve => { releaseGate = resolve; });
    const ready = new Promise(resolve => { signalReady = resolve; });
    const paused = { query: async (sql, values) => {
        const result = await first.query(sql, values);
        if (sql.startsWith('SELECT pg_advisory_xact_lock(') && !firstLock) {
            firstLock = true; signalReady(true); await gate;
        }
        return result;
    } };
    try {
        left = mutateScopedRepair(paused, 'disposable', [{ kind: 'replace', id: 1, expectedLibraryId: 1, libraryId: 2 }])
            .then(value => ({ value }), error => { signalReady(false); return { error }; });
        expect(await ready).toBe(true);
        const pid = (await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
        right = mutateScopedRepair(second, 'disposable', [{ kind: 'replace', id: 2, expectedLibraryId: 2, libraryId: 1 }])
            .then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(db, pid);
        // The second move must wait for the first library before owning the second library or any source row.
        expect((await db.query("SELECT objid::integer id,granted FROM pg_locks WHERE pid=$1 AND locktype='advisory' ORDER BY objid", [pid])).rows)
            .toEqual([{ id: 1, granted: false }]);
        releaseGate();
        expect(await left).toEqual({ value: { applied: 1 } });
        expect(await right).toEqual({ value: { applied: 1 } });
        expect((await db.query('SELECT library_id FROM scoped_repair_lab.scoped_repair_source ORDER BY id')).rows)
            .toEqual([{ library_id: 2 }, { library_id: 1 }]);
    } finally {
        releaseGate();
        if (left) await left;
        if (right) await right;
        await first.query('ROLLBACK'); await second.query('ROLLBACK'); first.release(); second.release();
    }
});
