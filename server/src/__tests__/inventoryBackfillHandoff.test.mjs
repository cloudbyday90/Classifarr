/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect, afterEach } from '@jest/globals';
import { drainInventoryBackfillHandoffs, materializeInventoryBackfillPage } from '../services/inventoryBackfillHandoff.mjs';
import { EnrichmentItemStateService } from '../services/enrichmentItemStateService.mjs';
import { QueueRefillService } from '../services/queueRefillService.mjs';
import { readRefillCandidatePage } from '../services/queueRefillCandidates.mjs';
import { withMetadataRefillOwnership, METADATA_REFILL_OWNER_LOCK } from '../services/queueRefillCoordination.mjs';

afterEach(() => jest.restoreAllMocks());
function fixture({ state = { library_id: 7, run_id: 'new' }, rows = [], checkpointCount = 1, synced = true } = {}) {
  const sync = jest.spyOn(EnrichmentItemStateService.prototype, 'syncItemStates')
    .mockImplementation(async ids => synced ? ids : []);
  const query = jest.fn(async sql => {
    if (sql.includes('SELECT s.*')) return { rows: state ? [state] : [] };
    if (sql.includes('WITH scan_bounds')) return { rows };
    if (sql.startsWith('INSERT INTO task_queue')) {
      const items = rows.filter(row => row.id);
      return { rows: items.map(row => ({ item_id: String(row.id) })), rowCount: items.length };
    }
    return { rowCount: checkpointCount };
  });
  const db = { query, withTransaction: jest.fn(fn => fn({ query })) };
  const buildPayload = jest.fn(row => ({ itemId: row.id }));
  return { query, db, sync, buildPayload, run: () => materializeInventoryBackfillPage({ db, buildPayload }) };
}
const row = { id: 8, scan_count: 1, scan_after_id: 8, through_id: 8, needs_standard_enrichment: true };

test('no eligible handoff permits the ordinary refill without writes', async () => {
  const f = fixture({ state: null });
  expect(await f.run()).toBeNull();
  expect(f.query.mock.calls).toHaveLength(3);
  expect(f.query.mock.calls[2][0]).toContain('FOR UPDATE OF s SKIP LOCKED');
  expect(f.buildPayload).not.toHaveBeenCalled();
});
test('jobs, item state and completion use the same transaction and run fence', async () => {
  const f = fixture({ rows: [row] });
  expect(await f.run()).toEqual({ queued: 1 });
  expect(f.db.withTransaction).toHaveBeenCalledTimes(1);
  expect(f.sync).toHaveBeenCalledWith([8]);
  expect(f.query.mock.calls.at(-1)[1]).toEqual([7, 'new', 0, null, true]);
});
test('full pages persist a cursor instead of claiming completion', async () => {
  const f = fixture({ rows: [{ ...row, scan_count: 250, scan_after_id: 250, through_id: 800 }] });
  await f.run();
  expect(f.query.mock.calls.at(-1)[1]).toEqual([7, 'new', 250, 800, false]);
});
test.each([['same', 40, 90], ['older', 0, null]])('checkpoint %s is resumed only for its run', async (savedRun, after, through) => {
  const f = fixture({ state: { library_id: 7, run_id: 'same', backfill_run_id: savedRun, backfill_after_id: 40, backfill_through_id: 90 } });
  await f.run();
  expect(f.query.mock.calls.find(([sql]) => sql.includes('WITH scan_bounds'))[1]).toEqual([6, after, through, 30, 7]);
});
test('an empty or ineligible page still acknowledges a complete pass', async () => {
  const f = fixture();
  expect(await f.run()).toEqual({ queued: 0 });
  expect(f.query.mock.calls.at(-1)[1]).toEqual([7, 'new', 0, null, true]);
});
test('invalid payload aborts before queue insertion or progress', async () => {
  const f = fixture({ rows: [row] });
  f.buildPayload.mockReturnValue(null);
  await expect(f.run()).rejects.toThrow('backfill_payload_invalid');
  expect(f.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
});
test('item state failure cannot acknowledge the page', async () => {
  const f = fixture({ rows: [row], synced: false });
  await expect(f.run()).rejects.toThrow('backfill_item_state_unavailable');
  expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
});
test('generation update failure aborts the transaction', async () => {
  const f = fixture({ checkpointCount: 0 });
  await expect(f.run()).rejects.toThrow('backfill_generation_changed');
});
test.each([{ libraryId: -1 }, { libraryId: 'bad' }, { batchLimit: 0 }, { batchLimit: 5001 }, { batchLimit: 1.2 }])
  ('invalid scope is rejected before querying: %j', async scope => {
    const query = jest.fn();
    await expect(readRefillCandidatePage({ query }, null, null, scope)).rejects.toThrow('Invalid backfill page bounds');
    expect(query).not.toHaveBeenCalled();
  });
test('refill drains durable demand before the ordinary global pass', async () => {
  const query = jest.fn();
  const materializeHandoff = jest.fn(async build => {
    expect(build({ id: 1, media_type: 'movie' })).toMatchObject({ itemId: 1 });
    return { queued: 1 };
  });
  const service = new QueueRefillService({ db: { query }, materializeHandoff });
  expect(await service.refillQueue()).toEqual({ queued: 1 });
  expect(query).not.toHaveBeenCalled();
});

test('the relay retains a bounded 5000-item scan budget per scheduled invocation', async () => {
  const page = jest.fn(async () => ({ queued: 250 }));
  const verify = jest.fn(async () => ({ status: 'unavailable' }));
  expect(await drainInventoryBackfillHandoffs({}, page, verify)).toEqual({ queued: 5000 });
  expect(verify).toHaveBeenCalledTimes(1);
  expect(page).toHaveBeenCalledTimes(20);
});
test('the relay stops promptly when no eligible handoff remains', async () => {
  const page = jest.fn().mockResolvedValueOnce({ queued: 2 }).mockResolvedValueOnce({ queued: 0 }).mockResolvedValue(null);
  const verify = jest.fn(async () => ({ status: 'idle' }));
  expect(await drainInventoryBackfillHandoffs({}, page, verify)).toEqual({ queued: 2 });
  expect(page).toHaveBeenCalledTimes(3);
  expect(await drainInventoryBackfillHandoffs({}, page, verify)).toBeNull();
});

test('scheduled and manual refills share an inner lock distinct from the scheduler lock', async () => {
  const refill = jest.fn(async () => ({ queued: 3 }));
  const db = { withSessionAdvisoryLock: jest.fn(async (_key, fn) => { await fn(); return true; }) };
  expect(METADATA_REFILL_OWNER_LOCK).not.toBe(2001);
  expect(await withMetadataRefillOwnership(db, refill)).toEqual({ queued: 3 });
  expect(db.withSessionAdvisoryLock).toHaveBeenCalledWith(METADATA_REFILL_OWNER_LOCK, expect.any(Function));
  db.withSessionAdvisoryLock.mockResolvedValue(false);
  expect(await withMetadataRefillOwnership(db, refill)).toEqual({ queued: 0 });
  expect(refill).toHaveBeenCalledTimes(1);
});
