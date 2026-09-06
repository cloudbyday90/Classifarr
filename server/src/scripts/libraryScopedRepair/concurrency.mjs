/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { performance } from 'node:perf_hooks';
import { lockScopedRepairLibraries } from './locking.mjs';
import { mutateScopedRepair } from './mutation.mjs';
import { visitScopedRepairInTransaction } from './visit.mjs';
import { pageRepairClock, PAGE_REPAIR_BENCHMARK_TIME as now } from '../libraryPageRepair/fixture.mjs';
import { waitForRepairBlocking } from '../libraryRepairAssessment/concurrency.mjs';

/** Two seeded rows (1 in library 1, 2 in library 2); all connections belong to the disposable runtime. */
export async function measureScopedConcurrency(observer, reader, writer) {
    const pid = (await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    let pending;
    try {
        await reader.query('BEGIN');
        await visitScopedRepairInTransaction(pageRepairClock(reader, now), { scope: 'disposable', libraryId: 1 });
        const start = performance.now();
        await mutateScopedRepair(writer, 'disposable', [{ kind: 'replace', id: 2, expectedLibraryId: 2, libraryId: 2 }]);
        const otherLibraryWriteMs = Number((performance.now() - start).toFixed(2));
        pending = mutateScopedRepair(writer, 'disposable', [{ kind: 'replace', id: 1, expectedLibraryId: 1, libraryId: 1 }])
            .then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(observer, pid);
        await reader.query('COMMIT');
        const same = await pending;
        if (same.error) throw same.error;
        await reader.query('BEGIN');
        await lockScopedRepairLibraries(reader, 'disposable', [2, 1], 'write');
        await reader.query('UPDATE scoped_repair_lab.scoped_repair_source SET library_id=2 WHERE id=1');
        pending = mutateScopedRepair(writer, 'disposable', [{ kind: 'replace', id: 2, expectedLibraryId: 2, libraryId: 1 }])
            .then(value => ({ value }), error => ({ error }));
        await waitForRepairBlocking(observer, pid);
        await reader.query('COMMIT');
        const opposite = await pending;
        if (opposite.error) throw opposite.error;
        const membership = (await observer.query('SELECT id,library_id FROM scoped_repair_lab.scoped_repair_source ORDER BY id')).rows;
        if (membership.length !== 2 || membership[0].library_id !== 2 || membership[1].library_id !== 1) throw new Error('Scoped move oracle mismatch');
        return { otherLibraryCommittedWhileReaderHeld: true, otherLibraryWriteMs,
            sameLibraryBlockedObserved: true, oppositeMoveBlockedBeforeWrite: true, oppositeMovesCommitted: true };
    } finally {
        await reader.query('ROLLBACK');
        if (pending) await pending;
        await writer.query('ROLLBACK');
    }
}
