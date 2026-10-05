/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { summarizeInventoryRecoveryProgress } from '../services/inventoryRecoveryProgress.mjs';
import { withInventoryBackgroundReadiness } from '../services/inventoryBackgroundReadiness.mjs';
import { readInventoryRecoveryProgress } from '../services/inventoryRecoveryProgressService.mjs';

const caseId = '56d6ff3b-21ee-457b-bf93-b3d2ef767b4b', asOf = '2026-09-27T12:00:00.000Z';
const at = hours => `2026-09-27T${String(hours).padStart(2, '0')}:00:00.000Z`;
const row = () => ({ tmdb_id: 7, media_type: 'movie', retry_after: at(9),
    recovery: { version: 1, case_id: caseId, tmdb_id: 7, media_type: 'movie', status: 'open', category: 'authentication',
        attempt_count: 2, first_seen: at(7), last_seen: at(8), resolved_at: null },
    progress: { version: 1, case_id: caseId, generation: caseId, released_at: at(8), eligible_at: at(9) } });
test('partitions cases, measures only observed intervals and excludes private data', () => {
    const rows = Array.from({ length: 7 }, row);
    rows[0].retry_after = at(13); rows[2].queued = true; rows[3].lease_until = at(13); rows[4].source_blocked = true;
    rows[5].recovery = { ...rows[5].recovery, status: 'resolved', resolved_at: at(11) };
    Object.assign(rows[5].progress, { queued_at: at(10), persisted_at: at(11) });
    rows[6].recovery = null; rows[6].private = 'do-not-expose';
    const result = summarizeInventoryRecoveryProgress(rows, asOf, 'ready');
    expect(result.stages).toEqual({ waiting: 1, ready: 1, queued: 1, checking: 1, blocked: 1, recovered: 1, unknown: 1 });
    expect(result.eligibleToQueue).toEqual({ samples: 1, seconds: 3600 });
    expect(result.queueToRecovery).toEqual({ samples: 1, seconds: 3600 });
    expect(result.oldestReadySeconds).toBe(10800);
    expect(JSON.stringify(result)).not.toMatch(/do-not-expose|case_id|tmdb_id/);
});
test('empty, bounded and malformed evidence never asserts unearned recovery', () => {
    expect(summarizeInventoryRecoveryProgress([], asOf, 'disabled')).toMatchObject({ total: 0, eligibleToQueue: { samples: 0, seconds: null } });
    expect(summarizeInventoryRecoveryProgress(Array.from({ length: 1001 }, row), asOf, 'ready')).toMatchObject({ total: 1000, truncated: true });
    for (const patch of [{ version: 9 }, { case_id: 'bad' }, { generation: 'bad' }, { released_at: at(13) }, { eligible_at: at(7) }]) {
        const item = row(); Object.assign(item.progress, patch);
        expect(summarizeInventoryRecoveryProgress([item], asOf, 'ready').stages.unknown).toBe(1);
    }
    const item = row(); item.progress.queued_at = at(7); item.attempted_at = at(11);
    expect(summarizeInventoryRecoveryProgress([item], asOf, 'ready')).toMatchObject({ stages: { waiting: 1 }, eligibleToQueue: { samples: 0 } });
});
test.each(['disabled', 'waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling', 'unavailable'])
('background worker waits without heavy work for %s and resumes automatically', async reason => {
    const worker = { run: jest.fn(async () => ({ status: 'done' })), stop: jest.fn() }, read = jest.fn(async () => reason);
    const guarded = withInventoryBackgroundReadiness(worker, {}, read);
    expect(await guarded.run()).toEqual({ status: 'deferred', reason }); expect(worker.run).not.toHaveBeenCalled();
    read.mockResolvedValue('ready'); expect(await guarded.run()).toEqual({ status: 'done' });
    guarded.stop(); expect(await guarded.run()).toEqual({ status: 'stopped' }); expect(worker.stop).toHaveBeenCalledTimes(1);
});
test('readiness coalesces and stop fences an outstanding probe; DB errors fail closed', async () => {
    let finish; const worker = { run: jest.fn(), stop: jest.fn() };
    const read = jest.fn(() => new Promise(resolve => { finish = resolve; }));
    const guarded = withInventoryBackgroundReadiness(worker, {}, read);
    const first = guarded.run(); expect(guarded.run()).toBe(first); guarded.stop(); finish('ready');
    expect(await first).toEqual({ status: 'stopped' }); expect(worker.run).not.toHaveBeenCalled();
    expect(await withInventoryBackgroundReadiness(worker, {}, async () => { throw new Error('private'); }).run())
        .toEqual({ status: 'deferred', reason: 'unavailable' });
});
test('optional diagnosis failure cannot bypass readiness or leak an exception', async () => {
    const worker = { run: jest.fn(), stop: jest.fn() };
    const read = async () => { throw new Error('PRIVATE database'); };
    const diagnose = () => { throw new Error('PRIVATE diagnostic'); };
    expect(await withInventoryBackgroundReadiness(worker, {}, read, diagnose).run())
        .toEqual({ status: 'deferred', reason: 'unavailable' });
    expect(worker.run).not.toHaveBeenCalled();
});
test('progress validates actor/filters and rechecks revocation after the read-only snapshot', async () => {
    const query = jest.fn(async sql => ({ rows: sql.includes('CASE') ? [{ readiness: 'ready' }] : [{ as_of: asOf, items: [] }] }));
    const db = { query: jest.fn(async () => ({ rows: [{ role: 'admin', is_active: true }] })), withTransaction: fn => fn({ query }) };
    await expect(readInventoryRecoveryProgress(db, 7, { limit: '10000' })).rejects.toMatchObject({ statusCode: 400 });
    expect(query).not.toHaveBeenCalled();
    expect(await readInventoryRecoveryProgress(db, 7)).toMatchObject({ total: 0 });
    expect(query.mock.calls[0][0]).toContain('READ ONLY');
    db.query.mockResolvedValueOnce({ rows: [{ role: 'admin', is_active: true }] }).mockResolvedValueOnce({ rows: [] });
    await expect(readInventoryRecoveryProgress(db, 7)).rejects.toMatchObject({ statusCode: 403 });
});
