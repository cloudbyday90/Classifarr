/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { admitImageIndexCapacity } from '../services/imageIndexCapacityAdmission.mjs';
import { IMAGE_INDEXES } from '../services/imageIndexMaintenanceContract.mjs';
import { INVENTORY_MAINTENANCE_IDLE_SQL } from '../services/inventoryBackgroundReadiness.mjs';

const MIB = 1024 ** 2, task = { id: '17' };
const needed = IMAGE_INDEXES.map(index => ({ index, action: 'create' }));
function fixture({ count = 10001, readiness = 'ready', available = 1024 * MIB } = {}) {
  const query = jest.fn(async sql => ({ rows: [sql === INVENTORY_MAINTENANCE_IDLE_SQL ? { readiness } : { vector_count: count }] }));
  const read = jest.fn(() => ({ available, constrained: 2048 * MIB, total: 16 * 1024 * MIB }));
  return { query, read, run: (plan = needed, memory = read) => admitImageIndexCapacity(query, task, plan, memory) };
}

test.each([0, 10000])('cohort %s retains the baseline without workload or memory probes', async count => {
  const f = fixture({ count });
  await expect(f.run()).resolves.toEqual({ status: 'admitted', workMemMiB: 64 });
  expect(f.query).toHaveBeenCalledTimes(1); expect(f.read).not.toHaveBeenCalled();
  expect(f.query.mock.calls[0][0]).toContain('LIMIT 10001');
});

test.each(['healthy', 'btree', 'external'])('%s does not scan or raise its workspace', async scenario => {
  const f = fixture(), plan = needed.map(row => ({ ...row,
    action: scenario === 'healthy' || row.index.accessMethod === 'hnsw' ? 'preserve' : 'create' }));
  await expect(f.run(scenario === 'external' ? needed : plan, scenario === 'external' ? null : f.read))
    .resolves.toEqual({ status: 'admitted', workMemMiB: 64 });
  expect(f.query).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
});

test.each([null, -1, 10002, '10001', NaN])('unknown cohort %s fails closed', async count => {
  await expect(fixture({ count }).run()).resolves.toMatchObject({ status: 'deferred', reason: 'image_index_capacity_unknown' });
});

test.each(['ingesting', 'backfilling', null])('large builds wait for %s without a memory probe', async readiness => {
  const f = fixture({ readiness });
  await expect(f.run()).resolves.toMatchObject({ status: 'deferred', reason: 'image_index_background_busy' });
  expect(f.query).toHaveBeenLastCalledWith(INVENTORY_MAINTENANCE_IDLE_SQL, ['17']);
  expect(f.read).not.toHaveBeenCalled();
});

test.each([false, true])('unavailable memory (throws=%s) never grants capacity', async throws => {
  const f = fixture(); f.read.mockImplementation(() => { if (throws) throw new Error('private'); return null; });
  await expect(f.run()).resolves.toMatchObject({ status: 'deferred', reason: 'image_index_memory_unknown' });
});

test('workspace plus overhead plus reserve is required at the exact boundary', async () => {
  await expect(fixture({ available: 1024 * MIB - 1 }).run()).resolves.toMatchObject({ reason: 'image_index_memory_pressure' });
  await expect(fixture().run()).resolves.toEqual({ status: 'admitted', workMemMiB: 512 });
});

test('manual readiness excludes only its own task and retains unfinished/backfill guards', () => {
  expect(INVENTORY_MAINTENANCE_IDLE_SQL).toContain('id IS DISTINCT FROM $1::bigint');
  expect(INVENTORY_MAINTENANCE_IDLE_SQL).toContain('backfill_run_id IS DISTINCT FROM s.run_id');
  expect(INVENTORY_MAINTENANCE_IDLE_SQL).toContain("s.phase<>'complete'");
  expect(INVENTORY_MAINTENANCE_IDLE_SQL).not.toMatch(/waiting_for_inventory|waiting_for_libraries|rag_enabled/);
});
