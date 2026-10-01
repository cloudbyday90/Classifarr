/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { runImageIndexMaintenance } from '../../services/imageIndexMaintenance.mjs';
import { inspectImageIndexes } from '../../services/imageIndexMaintenanceCatalog.mjs';
import { IMAGE_INDEXES, IMAGE_INDEX_LOCK_KEY } from '../../services/imageIndexMaintenanceContract.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../../utils/backupRestoreSessionContract.mjs';

const query = (...args) => getPool().query(...args);
const maintain = options => runImageIndexMaintenance({ database: { pool: getPool() }, ...options });
const enqueue = async () => (await query(`INSERT INTO task_queue (task_type, payload)
  VALUES ('rebuild_hnsw_index', '{"sql":"DROP DATABASE ignored"}') RETURNING id`)).rows[0];
const claim = async () => {
  const task = await enqueue();
  return (await query(`UPDATE task_queue SET status = 'processing', claim_token = gen_random_uuid(),
    visible_at = clock_timestamp() + INTERVAL '5 minutes' WHERE id = $1 RETURNING id, claim_token`, [task.id])).rows[0];
};
const row = async task => (await query('SELECT * FROM task_queue WHERE id = $1', [task.id])).rows[0];

beforeEach(async () => {
  await query('DELETE FROM task_queue');
  for (const index of IMAGE_INDEXES) await query(index.drop.replace('CONCURRENTLY', 'CONCURRENTLY IF EXISTS'));
});

test('no pending task performs no DDL; one-shot creates exactly three indexes and acknowledges only one job', async () => {
  await expect(maintain()).resolves.toEqual({ status: 'no_work' });
  expect((await inspectImageIndexes(query)).every(value => value.action === 'create')).toBe(true);
  const first = await enqueue(), second = await enqueue();
  await expect(maintain()).resolves.toMatchObject({ status: 'complete', created: 3, repaired: 0 });
  expect((await row(first)).status).toBe('completed');
  expect((await row(second)).status).toBe('pending');
  await expect(maintain()).resolves.toMatchObject({ status: 'complete', created: 0, repaired: 0 });
  expect((await inspectImageIndexes(query)).every(value => value.action === 'preserve')).toBe(true);
});

test('unexpected same-name definition is preserved and consumes one bounded failure attempt', async () => {
  await query('CREATE INDEX idx_embeddings_image_hash ON classification_embeddings (image_model)');
  const task = await enqueue();
  await expect(maintain()).rejects.toThrow('image_index_definition_mismatch');
  expect((await row(task))).toMatchObject({ status: 'pending', attempts: 1, claim_token: null });
  expect((await query("SELECT to_regclass('public.idx_embeddings_image_hnsw') AS index")).rows[0].index).toBeNull();
  expect((await query("SELECT pg_get_indexdef('public.idx_embeddings_image_hash'::regclass) AS definition")).rows[0].definition)
    .toContain('(image_model)');
});

test('local disconnect checking is set on the build session only and never leaks into the pool', async () => {
  const before = (await query('SHOW client_connection_check_interval')).rows[0];
  let seen = false;
  const database = { pool: { connect: async () => {
    const client = await getPool().connect();
    return { on: (...args) => client.on(...args), removeListener: (...args) => client.removeListener(...args),
      release: discard => client.release(discard), query: async (sql, params) => {
        if (sql === IMAGE_INDEXES[0].create) {
          expect((await client.query('SHOW client_connection_check_interval')).rows[0].client_connection_check_interval).toBe('1s');
          seen = true;
        }
        return client.query(sql, params);
      } };
  } } };
  await expect(runImageIndexMaintenance({ database, task: await claim(), monitorClientDisconnect: true }))
    .resolves.toMatchObject({ status: 'complete' });
  expect(seen).toBe(true);
  expect((await query('SHOW client_connection_check_interval')).rows[0]).toEqual(before);
});

test.each(['expired', 'replaced', 'wrong-type'])('%s claim cannot create or acknowledge indexes', async scenario => {
  const task = await claim();
  if (scenario === 'expired') await query("UPDATE task_queue SET visible_at = NOW() - INTERVAL '1 second' WHERE id = $1", [task.id]);
  if (scenario === 'replaced') task.claim_token = randomUUID();
  if (scenario === 'wrong-type') await query("UPDATE task_queue SET task_type = 'classification' WHERE id = $1", [task.id]);
  await expect(maintain({ task })).rejects.toThrow('queue_claim_not_owned');
  expect((await inspectImageIndexes(query)).every(value => value.action === 'create')).toBe(true);
  expect((await row(task)).status).toBe('processing');
});

test('shared runtime allows online maintenance but blocks offline; index contention defers a claim without an attempt', async () => {
  const owner = await getPool().connect();
  try {
    await owner.query('SELECT pg_advisory_lock_shared($1)', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    await expect(maintain()).resolves.toMatchObject({ status: 'deferred', reason: 'runtime_or_restore_active' });
    await owner.query('SELECT pg_advisory_lock($1)', [IMAGE_INDEX_LOCK_KEY]);
    const task = await claim();
    await expect(maintain({ task })).resolves.toMatchObject({ status: 'deferred', reason: 'image_index_maintenance_busy' });
    expect(await row(task)).toMatchObject({ status: 'pending', attempts: 0, claim_token: null });
    expect(new Date((await row(task)).next_retry_at).getTime()).toBeGreaterThan(Date.now());
    await owner.query('SELECT pg_advisory_unlock($1)', [IMAGE_INDEX_LOCK_KEY]);
    await expect(maintain({ task: await claim() })).resolves.toMatchObject({ status: 'complete' });
  } finally { owner.release(true); }
});

test('exclusive restore admission blocks both paths without touching the queue', async () => {
  const owner = await getPool().connect();
  try {
    await owner.query('SELECT pg_advisory_lock($1)', [RUNTIME_MAINTENANCE_LOCK_KEY]);
    const task = await claim();
    await expect(maintain({ task })).resolves.toMatchObject({ status: 'deferred' });
    expect((await row(task)).claim_token).toBe(task.claim_token);
    await expect(maintain()).resolves.toMatchObject({ status: 'deferred' });
  } finally { owner.release(true); }
});

test('revocation after one statement permits neither a second index nor stale completion', async () => {
  const task = await claim();
  const database = { pool: { connect: async () => {
    const client = await getPool().connect();
    return { on: (...args) => client.on(...args), removeListener: (...args) => client.removeListener(...args),
      release: discard => client.release(discard), query: async (sql, params) => {
        const result = await client.query(sql, params);
        if (sql === IMAGE_INDEXES[0].create) await query('UPDATE task_queue SET claim_token = gen_random_uuid() WHERE id = $1', [task.id]);
        return result;
      } };
  } } };
  await expect(runImageIndexMaintenance({ database, task })).rejects.toThrow('queue_claim_not_owned');
  expect((await inspectImageIndexes(query)).map(value => value.action)).toEqual(['preserve', 'create', 'create']);
  expect((await row(task)).status).toBe('processing');
  expect((await row(task)).claim_token).not.toBe(task.claim_token);
});

test('restoration quarantine does not claim existing work', async () => {
  const task = await enqueue();
  await query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'requires_maintenance' WHERE gate_id = 1");
  try {
    await expect(maintain()).resolves.toMatchObject({ status: 'deferred', reason: 'restore_verification_required' });
    expect((await row(task)).status).toBe('pending');
  } finally { await query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'ready' WHERE gate_id = 1"); }
});

test('failed last attempt terminates; future-due tasks are not consumed', async () => {
  const task = await enqueue();
  await query('UPDATE task_queue SET attempts = max_attempts - 1 WHERE id = $1', [task.id]);
  await query('CREATE INDEX idx_embeddings_image_present ON classification_embeddings (image_model)');
  await expect(maintain()).rejects.toThrow('image_index_definition_mismatch');
  expect((await row(task)).status).toBe('failed');
  const next = await enqueue();
  await query("UPDATE task_queue SET next_retry_at = NOW() + INTERVAL '1 hour' WHERE id = $1", [next.id]);
  await expect(maintain()).resolves.toEqual({ status: 'no_work' });
});

test('a cancelled real concurrent build leaves an invalid index which the next owned job repairs', async () => {
  const writer = await getPool().connect(), builder = await getPool().connect();
  let build;
  try {
    await writer.query('BEGIN');
    await writer.query('LOCK TABLE classification_embeddings IN ROW EXCLUSIVE MODE');
    const pid = (await builder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    build = builder.query(IMAGE_INDEXES[0].create).then(() => null, error => error);
    let appeared = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await query("SELECT to_regclass('public.idx_embeddings_image_hnsw') AS index")).rows[0].index) { appeared = true; break; }
      await new Promise(resolve => { setTimeout(resolve, 20); });
    }
    expect(appeared).toBe(true);
    await query('SELECT pg_cancel_backend($1)', [pid]);
    expect((await build).code).toBe('57014');
    await writer.query('ROLLBACK');
    expect((await inspectImageIndexes(query))[0].action).toBe('repair');
    await enqueue();
    await expect(maintain()).resolves.toMatchObject({ status: 'complete', repaired: 1, created: 2 });
  } finally {
    await writer.query('ROLLBACK');
    writer.release(true); builder.release(true);
    if (build) await build;
  }
}, 15_000);
