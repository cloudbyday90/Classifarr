/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { inspectQueueVacuum, loadQueueVacuumState } from '../../services/queueVacuumObservation.mjs';
import { runQueueVacuumMaintenance } from '../../services/queueVacuumMaintenance.mjs';
import { prepareQueueVacuumRecovery, reserveQueueVacuumAttempt, finishQueueVacuumAttempt } from '../../services/queueVacuumRecoveryRepository.mjs';
import { queueVacuumRow } from '../helpers/queueVacuumFixture.mjs';
import { readQueueTableOptions, withQueueVacuumPressure } from '../helpers/queueVacuumPressureFixture.mjs';
import { observeQueueVacuumAttempt } from '../helpers/queueVacuumAttemptEvidence.mjs';

const query = (sql, params) => getPool().query(sql, params);
const maintain = options => runQueueVacuumMaintenance({ database: { pool: getPool() }, ...options });
const state = async () => (await query('SELECT * FROM queue_vacuum_recovery_state WHERE singleton')).rows[0];

beforeEach(async () => {
  await query('DELETE FROM queue_vacuum_recovery_state');
  await query('INSERT INTO queue_vacuum_recovery_state (singleton) VALUES (true)');
});

test('fresh settings include existing tuning; manual vacuum preserves queue rows and verifies both counters', async () => {
  await query("INSERT INTO task_queue (task_type, payload, status) VALUES ('synthetic_vacuum', '{}', 'completed')");
  const before = await query('SELECT count(*) FROM task_queue');
  expect(await inspectQueueVacuum({ database: { query } })).toMatchObject({ status: 'autovacuum_enabled',
    vacuumThreshold: 50, vacuumScaleFactor: 0.01, analyzeScaleFactor: 0.05 });
  await expect(maintain()).resolves.toMatchObject({ status: 'complete' });
  expect((await query('SELECT count(*) FROM task_queue')).rows).toEqual(before.rows);
});
test('fresh backend recovery only observes and initializes state; it does not vacuum', async () => {
  await query('DELETE FROM queue_vacuum_recovery_state');
  const before = await loadQueueVacuumState(query);
  await expect(maintain({ automatic: true })).resolves.toMatchObject({ status: 'idle' });
  expect((await state()).attempts).toBe(0);
  expect((await loadQueueVacuumState(query)).vacuum_count).toBe(before.vacuum_count);
});
test('ordinary read-only role can inspect but cannot silently skip and claim maintenance success', async () => {
  const role = `vacuum_reader_${randomUUID().replaceAll('-', '')}`;
  await query(`CREATE ROLE ${role}`);
  await query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await query(`GRANT SELECT ON policy_native_intent_reconciliation_restore_gates TO ${role}`);
  const database = { pool: { connect: async () => {
    const client = await getPool().connect(); await client.query(`SET ROLE ${role}`); return client;
  } } };
  const reader = await database.pool.connect();
  try {
    expect(await inspectQueueVacuum({ database: { query: (...args) => reader.query(...args) } }))
      .toMatchObject({ status: 'autovacuum_enabled' });
    await expect(runQueueVacuumMaintenance({ database })).resolves.toMatchObject({ reason: 'maintenance_privilege_required' });
  } finally {
    reader.release(true);
    await query(`DROP OWNED BY ${role}`); await query(`DROP ROLE ${role}`);
  }
});
test.each([2024, 2027, 2012])('admission lock %i prevents physical work', async key => {
  const owner = await getPool().connect();
  try {
    await owner.query('SELECT pg_advisory_lock($1)', [key]);
    await expect(maintain({ automatic: true })).resolves.toMatchObject({ status: 'deferred' });
    await expect(maintain()).resolves.toMatchObject({ status: 'deferred' });
  } finally { owner.release(true); }
});
test('shared runtime admission permits an idle automatic check but blocks offline apply', async () => {
  const owner = await getPool().connect();
  try {
    await owner.query('SELECT pg_advisory_lock_shared(2024)');
    await expect(maintain()).resolves.toMatchObject({ reason: 'runtime_or_restore_active' });
    await expect(maintain({ automatic: true })).resolves.toMatchObject({ status: 'idle' });
  } finally { owner.release(true); }
});
test('restore quarantine leaves durable state and queue untouched', async () => {
  await query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'requires_maintenance' WHERE gate_id = 1");
  try {
    await expect(maintain({ automatic: true })).resolves.toMatchObject({ reason: 'restore_verification_required' });
    expect((await state()).last_result).toBe('unobserved');
  } finally { await query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'ready' WHERE gate_id = 1"); }
});
test('inheritance cannot expand the fixed-table target', async () => {
  await query('CREATE TABLE vacuum_child () INHERITS (task_queue)');
  try { await expect(maintain()).rejects.toThrow('relation_unsupported'); }
  finally { await query('DROP TABLE vacuum_child'); }
});
test('conflicting table lock cannot turn skipped VACUUM into success', async () => {
  const owner = await getPool().connect();
  try {
    await owner.query('BEGIN');
    await owner.query('LOCK TABLE task_queue IN SHARE UPDATE EXCLUSIVE MODE');
    await expect(maintain()).rejects.toThrow('not_confirmed');
  } finally { await owner.query('ROLLBACK'); owner.release(true); }
});
test('durable admission survives reconnects, consumes attempt before work, and prevents rapid retry', async () => {
  const row = queueVacuumRow({ sampled_at: new Date() });
  await query(`UPDATE queue_vacuum_recovery_state SET statistics_epoch = '123:initial',
    vacuum_progress = '1:1', pressure_since = clock_timestamp() - INTERVAL '2 hours',
    observed_at = clock_timestamp() - INTERVAL '15 minutes'`);
  // Match the executor's pinned-session contract; the third argument is our timeout,
  // not pg's optional callback, and BEGIN/COMMIT must never use pooled queries.
  const first = await getPool().connect();
  try {
    await first.query('SELECT pg_advisory_lock(2027)');
    const pinned = (sql, params) => first.query(sql, params);
    // Fresh platform has no completed inventory: even sustained pressure must wait.
    expect(await prepareQueueVacuumRecovery(pinned, row)).toMatchObject({ reason: 'waiting_for_platform_idle' });
    expect((await state()).attempts).toBe(0);
    await reserveQueueVacuumAttempt(pinned);
  } finally { first.release(true); }
  expect(await state()).toMatchObject({ attempts: 1, last_result: 'running' });
  const client = await getPool().connect();
  try { await expect(reserveQueueVacuumAttempt((sql, params) => client.query(sql, params))).rejects.toThrow('not_reserved'); }
  finally { client.release(true); }
  await finishQueueVacuumAttempt(query, false);
  expect(await prepareQueueVacuumRecovery(query, row)).toMatchObject({ reason: 'cooldown' });
  expect((await state()).attempts).toBe(1);
});
test('disabled table autovacuum requests review without changing the setting', async () => {
  await query('ALTER TABLE task_queue SET (autovacuum_enabled = false)');
  try {
    expect(await inspectQueueVacuum({ database: { query } })).toMatchObject({ reason: 'queue_autovacuum_disabled' });
    await expect(maintain({ automatic: true })).resolves.toMatchObject({ reason: 'autovacuum_disabled' });
    expect((await loadQueueVacuumState(query)).table_enabled).toBe(false);
  } finally { await query('ALTER TABLE task_queue RESET (autovacuum_enabled)'); }
});

test.each([1, 2, 3])('eligible recovery verifies real reclamation and restores its fixture (cycle %i)', async () => {
  const options = await readQueueTableOptions(query);
  await withQueueVacuumPressure(getPool(), async before => {
    const reports = [];
    const outcome = await observeQueueVacuumAttempt(getPool(), { report: value => reports.push(value) });
    // The full bounded outcome is included in Jest's diff if verification fails.
    expect(outcome).toMatchObject({ result: { status: 'complete' }, error: null,
      evidence: { commands: 1, notices: [] } });
    expect(reports).toEqual([expect.objectContaining({ status: 'started', reason: 'sustained_pressure' })]);
    expect(await state()).toMatchObject({ attempts: 1, last_result: 'completed' });
    expect(new Date((await state()).next_attempt_at).getTime()).toBeGreaterThan(Date.now() + 5 * 3600000);
    const after = await loadQueueVacuumState(query);
    expect(BigInt(after.vacuum_count)).toBeGreaterThan(BigInt(before.vacuum_count));
    expect(BigInt(after.analyze_count)).toBeGreaterThan(BigInt(before.analyze_count));
    expect(Number(after.n_dead_tup)).toBeLessThan(10000);
    expect(await maintain({ automatic: true })).toMatchObject({ status: 'idle' });
    expect((await state()).attempts).toBe(0);
  });
  expect((await readQueueTableOptions(query)).sort()).toEqual(options.sort());
});

test('a lock arriving after reservation cannot claim completion or authorize an immediate retry', async () => {
  await withQueueVacuumPressure(getPool(), async before => {
    const owner = await getPool().connect();
    let reserved;
    try {
      const outcome = await observeQueueVacuumAttempt(getPool(), { beforeVacuum: async () => {
        reserved = await state();
        await owner.query('BEGIN');
        await owner.query('LOCK TABLE public.task_queue IN SHARE UPDATE EXCLUSIVE MODE');
      } });
      expect(reserved).toMatchObject({ attempts: 1, last_result: 'running' });
      expect(outcome).toMatchObject({ result: null,
        error: { category: 'completion_unverified', diagnosis: { reason: 'lock_interference' } },
        evidence: { commands: 1, notices: [{ warning: true, code: '55P03' }] } });
      const after = await loadQueueVacuumState(query);
      expect(after.vacuum_count).toBe(before.vacuum_count);
      expect(after.analyze_count).toBe(before.analyze_count);
      expect(await state()).toMatchObject({ attempts: 1, last_result: 'unverified',
        next_attempt_at: reserved.next_attempt_at });
    } finally { await owner.query('ROLLBACK'); owner.release(true); }
    const retry = await observeQueueVacuumAttempt(getPool());
    expect(retry).toMatchObject({ result: { reason: 'cooldown' }, error: null, evidence: { commands: 0 } });
    expect(await state()).toMatchObject({ attempts: 1, last_result: 'cooldown',
      next_attempt_at: reserved.next_attempt_at });
  });
});

test('pressure fixture restores table settings and removes its inventory when its callback fails', async () => {
  const original = await readQueueTableOptions(query);
  const libraries = (await query('SELECT count(*) FROM libraries')).rows;
  const items = (await query('SELECT count(*) FROM media_server_items')).rows;
  await expect(withQueueVacuumPressure(getPool(), async () => { throw new Error('synthetic callback failure'); }))
    .rejects.toThrow('synthetic callback failure');
  expect((await readQueueTableOptions(query)).sort()).toEqual(original.sort());
  expect((await query('SELECT count(*) FROM libraries')).rows).toEqual(libraries);
  expect((await query('SELECT count(*) FROM media_server_items')).rows).toEqual(items);
});
