/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { runImageIndexMaintenance } from '../services/imageIndexMaintenance.mjs';
import { inspectImageIndexes } from '../services/imageIndexMaintenanceCatalog.mjs';
import { IMAGE_INDEXES, IMAGE_INDEX_BUDGET_MS } from '../services/imageIndexMaintenanceContract.mjs';
import { captureImageIndexClaim, imageIndexClaimRemaining, finishImageIndexClaim } from '../services/imageIndexMaintenanceClaims.mjs';

const task = { id: 1, claim_token: '11111111-1111-4111-8111-111111111111' };
const catalog = () => IMAGE_INDEXES.map(index => ({ ...index, method: index.accessMethod, relkind: 'i', expected_table: true,
  valid: true, ready: true, live: true, special: false, expressions: false, keys_only: true,
  constrained: false, default_order: true, default_collation: true }));
function fixture({ rows = catalog(), pending = task } = {}) {
  const client = Object.assign(new EventEmitter(), { release: jest.fn() });
  client.query = jest.fn(async sql => {
    if (sql.includes('pg_try_advisory')) return { rows: [{ acquired: true }] };
    if (sql.startsWith('SELECT gate_state')) return { rows: [{ gate_state: 'ready' }] };
    if (sql.includes('FROM pg_class c')) return { rows };
    if (sql.startsWith('SELECT EXTRACT')) return { rows: [{ remaining: 150_000 }] };
    if (sql.includes('RETURNING id, claim_token')) return { rows: pending ? [pending] : [] };
    if (sql.startsWith('SELECT id') || sql.includes('RETURNING id')) return { rows: [{ id: 1 }] };
    return { rows: [] };
  });
  const database = { pool: { connect: jest.fn(async () => client) } };
  return { client, database, run: options => runImageIndexMaintenance({ database, ...options }) };
}

test('healthy indexes are preserved; one pinned session is discarded and result acknowledged', async () => {
  const f = fixture();
  await expect(f.run({ task })).resolves.toMatchObject({ status: 'complete', created: 0, repaired: 0 });
  expect(f.client.query.mock.calls.some(([sql]) => /^(CREATE|DROP) INDEX/.test(sql))).toBe(false);
  expect(f.client.query).toHaveBeenCalledWith("SET maintenance_work_mem = '64MB'", []);
  expect(f.client.query).toHaveBeenCalledWith('SET max_parallel_maintenance_workers = 0', []);
  expect(f.client.release.mock.calls).toEqual([[true]]);
  expect(f.client.listenerCount('error')).toBe(0);
});
test('empty setup does not inspect catalogs or execute DDL', async () => {
  const f = fixture({ pending: null });
  await expect(f.run()).resolves.toEqual({ status: 'no_work' });
  expect(f.client.query.mock.calls.some(([sql]) => sql.includes('FROM pg_class c'))).toBe(false);
});
test('missing and invalid indexes execute only fixed DDL then verify and complete', async () => {
  const rows = catalog(); rows[0].valid = false; rows.pop();
  const f = fixture({ rows }), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(async (sql, params) => {
    const index = IMAGE_INDEXES.find(value => value.create === sql || value.drop === sql);
    if (index) {
      if (sql === index.drop) rows.splice(rows.findIndex(value => value.name === index.name), 1);
      else rows.push(catalog().find(value => value.name === index.name));
    }
    return real(sql, params);
  });
  await expect(f.run({ task })).resolves.toMatchObject({ status: 'complete', repaired: 1, created: 1 });
  const ddl = f.client.query.mock.calls.filter(([sql]) => /^(CREATE|DROP) INDEX/.test(sql)).map(([sql]) => sql);
  expect(ddl).toEqual([IMAGE_INDEXES[0].drop, IMAGE_INDEXES[0].create, IMAGE_INDEXES[2].create]);
});
test('post-build invalid state fails verification and one-shot schedules a bounded failed attempt', async () => {
  const f = fixture({ rows: [] });
  await expect(f.run()).rejects.toThrow('image_index_verification_failed');
  const writes = f.client.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE public.task_queue SET\n'));
  expect(writes).toHaveLength(1);
  expect(writes[0][1][2]).toBe('failed');
});
test.each([true, false])('index contention is deferred (online=%s)', async online => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation((sql, params) => params?.[0] === 2026 ? { rows: [{ acquired: false }] } : real(sql, params));
  await expect(f.run(online ? { task } : {})).resolves.toMatchObject({ status: 'deferred' });
  expect(f.client.query.mock.calls.some(([sql]) => sql.includes('FROM pg_class c'))).toBe(false);
});
test('admission denial does not touch a restore-owned queue', async () => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation((sql, params) => params?.[0] === 2024 ? { rows: [{ acquired: false }] } : real(sql, params));
  await expect(f.run({ task })).resolves.toMatchObject({ status: 'deferred', reason: 'runtime_or_restore_active' });
  expect(f.client.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
});
test('captured task cannot be mutated while waiting for its connection', async () => {
  const f = fixture(), mutable = { ...task };
  const promise = f.run({ task: mutable });
  mutable.claim_token = '22222222-2222-4222-8222-222222222222';
  mutable.id = 2;
  await promise;
  expect(f.client.query.mock.calls.filter(([sql]) => sql.startsWith('SELECT EXTRACT'))
    .every(([, params]) => params[0] === task.id && params[1] === task.claim_token)).toBe(true);
});
test.each([null, {}, { ...task, id: '1;DROP TABLE x' }, { ...task, claim_token: null }])('invalid captured claim %j fails before connecting', async invalid => {
  expect(() => captureImageIndexClaim(invalid)).toThrow('queue_claim_not_owned');
});
test.each([undefined, null, -1, 0, 100, 'NaN'])('missing or expired deadline %s fails closed', async remaining => {
  await expect(imageIndexClaimRemaining(async () => ({ rows: [{ remaining }] }), task)).rejects.toThrow('queue_claim_not_owned');
});
test.each([
  { relkind: 'r' }, { expected_table: false }, { method: 'hash' }, { special: true },
  { expressions: true }, { keys_only: false }, { constrained: true }, { default_order: false },
  { default_collation: false }, { predicate: '(image_model IS NOT NULL)' }, { columns: ['image_model'] },
  { opclasses: ['vector_l2_ops'] }, { options: ['m=32', 'ef_construction=64'] },
])('unexpected catalog definition %j is never repaired', async change => {
  const rows = catalog(); Object.assign(rows[0], change);
  const f = fixture({ rows });
  await expect(f.run({ task })).rejects.toThrow('image_index_definition_mismatch');
  expect(f.client.query.mock.calls.some(([sql]) => /^(CREATE|DROP) INDEX/.test(sql))).toBe(false);
  expect(f.client.release).toHaveBeenCalledWith(true);
});
test.each(['valid', 'ready', 'live'])('false %s schedules repair only for the known definition', async property => {
  const rows = catalog(); rows[0][property] = false;
  const plan = await inspectImageIndexes(async () => ({ rows }));
  expect(plan.map(value => value.action)).toEqual(['repair', 'preserve', 'preserve']);
});
test('restore quarantine stops before queue claim or index work', async () => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(sql => sql.startsWith('SELECT gate_state') ? { rows: [] } : real(sql));
  await expect(f.run()).resolves.toMatchObject({ status: 'deferred', reason: 'restore_verification_required' });
  expect(f.client.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
});
test('connection loss never reconnects or acknowledges', async () => {
  const f = fixture(), real = f.client.query.getMockImplementation();
  f.client.query.mockImplementation(async sql => {
    if (sql.startsWith('SELECT gate_state')) f.client.emit('error', new Error('synthetic_lost'));
    return real(sql);
  });
  await expect(f.run({ task })).rejects.toThrow('synthetic_lost');
  expect(f.database.pool.connect).toHaveBeenCalledTimes(1);
  expect(f.client.release.mock.calls).toEqual([[true]]);
});
test('total budget destroys a stuck session and leaves no timer or duplicate release', async () => {
  jest.useFakeTimers();
  try {
    const f = fixture();
    let unblock;
    f.client.query.mockImplementationOnce(() => new Promise(resolve => { unblock = resolve; }));
    const work = f.run({ task });
    const rejected = expect(work).rejects.toThrow('image_index_maintenance_deadline');
    await jest.advanceTimersByTimeAsync(IMAGE_INDEX_BUDGET_MS);
    expect(f.client.release.mock.calls).toEqual([[true]]);
    unblock({ rows: [] });
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
test('claim loss while waiting for completion lock rolls back instead of success', async () => {
  const query = jest.fn(async sql => ({ rows: sql.startsWith('SELECT id') ? [] : [{ remaining: 150000 }] }));
  await expect(finishImageIndexClaim(query, task, { status: 'complete' })).rejects.toThrow('queue_claim_not_owned');
  expect(query).toHaveBeenCalledWith('ROLLBACK');
  expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
});
