/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { reconcileImageIndexes } from '../../services/imageIndexReconciliation.mjs';
import { runImageIndexMaintenance } from '../../services/imageIndexMaintenance.mjs';
import { inspectImageIndexes } from '../../services/imageIndexMaintenanceCatalog.mjs';
import { IMAGE_INDEXES, IMAGE_INDEX_LOCK_KEY } from '../../services/imageIndexMaintenanceContract.mjs';
import { RUNTIME_MAINTENANCE_LOCK_KEY } from '../../utils/backupRestoreSessionContract.mjs';
import { checkRAG } from '../../services/healthCheckRAG.mjs';

const query = (...args) => getPool().query(...args);
const reconcile = () => reconcileImageIndexes({ database: { pool: getPool() } });
const state = async () => (await query('SELECT * FROM image_index_reconciliation_state')).rows[0];
const jobs = async () => (await query("SELECT * FROM task_queue WHERE task_type = 'rebuild_hnsw_index'")).rows;
const claim = async id => (await query(`UPDATE task_queue SET status = 'processing', claim_token = gen_random_uuid(),
  visible_at = clock_timestamp() + INTERVAL '5 minutes' WHERE id = $1 RETURNING id, claim_token`, [id])).rows[0];
const maintain = task => runImageIndexMaintenance({ database: { pool: getPool() }, task });
let libraryId;
beforeEach(async () => {
  await query('DELETE FROM task_queue');
  await query('DELETE FROM image_index_reconciliation_state');
  await query('DELETE FROM media_server_sync_status');
  await query('DELETE FROM libraries');
  await query(`UPDATE ai_provider_config SET rag_enabled = true, rag_image_weight = 0.5,
    image_embedding_provider_mode = 'separate_local', image_embedding_local_host = 'http://unused.invalid' WHERE id = 1`);
  libraryId = (await query("INSERT INTO libraries(name,external_id,media_type,is_active) VALUES ('Fixture','fixture','movie',true) RETURNING id")).rows[0].id;
  await query("INSERT INTO media_server_items(library_id,external_id,title,media_type,tmdb_id) VALUES ($1,'item','Fixture','movie',7)", [libraryId]);
  for (const index of IMAGE_INDEXES) await query(index.drop.replace('CONCURRENTLY', 'CONCURRENTLY IF EXISTS'));
});

test('parallel observations queue exactly one task; actual worker repairs and healthy checks become write-free', async () => {
  await Promise.all(Array.from({ length: 8 }, reconcile));
  const [job] = await jobs(); expect(await jobs()).toHaveLength(1);
  expect(job).toMatchObject({ source: 'image_index_reconciliation', max_attempts: 3, priority: 1, payload: {} });
  expect((await state()).task_id).toBe(job.id);
  await expect(reconcile()).resolves.toMatchObject({ reason: 'existing_task' });
  await expect(maintain(await claim(job.id))).resolves.toMatchObject({ status: 'complete', created: 3 });
  expect((await state()).attempts).toBe(1);
  await expect(reconcile()).resolves.toEqual({ status: 'idle', reason: 'healthy' });
  const healthy = await state(); expect(healthy).toMatchObject({ task_id: null, attempts: 0 });
  expect(healthy.next_attempt_at).not.toBeNull();
  await reconcile(); expect(await state()).toEqual(healthy); expect(await jobs()).toHaveLength(1);
});

test('fresh, disabled, inactive, ingesting and backfilling setups do not queue repairs; music remains rejected', async () => {
  await query('UPDATE ai_provider_config SET rag_enabled = false');
  expect((await reconcile()).reason).toBe('disabled');
  await query('UPDATE ai_provider_config SET rag_enabled = true, rag_image_weight = 0');
  expect((await reconcile()).reason).toBe('disabled');
  await query('UPDATE ai_provider_config SET rag_image_weight = 0.5');
  await expect(query("UPDATE libraries SET media_type = 'music'")).rejects.toThrow('libraries_media_type_check');
  await query('UPDATE libraries SET is_active = false');
  expect((await reconcile()).reason).toBe('waiting_for_libraries');
  await query('UPDATE libraries SET is_active = true');
  await query('DELETE FROM media_server_items');
  expect((await reconcile()).reason).toBe('waiting_for_inventory');
  await query("INSERT INTO media_server_items(library_id,external_id,title,media_type) VALUES ($1,'item','Fixture','movie')", [libraryId]);
  await query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','pending')", [libraryId]);
  expect((await reconcile()).reason).toBe('ingesting');
  await query("UPDATE media_server_sync_status SET status = 'completed'");
  await query("INSERT INTO task_queue(task_type,payload,status) VALUES ('metadata_enrichment','{}','processing')");
  expect((await reconcile()).reason).toBe('backfilling');
  expect(await jobs()).toEqual([]); expect(await state()).toBeUndefined();
});

test.each(['disabled', 'ingesting', 'backfilling'])('worker rechecks %s after enqueue, deferring without consuming a started attempt', async reason => {
  const { taskId } = await reconcile();
  if (reason === 'disabled') await query('UPDATE ai_provider_config SET rag_enabled = false');
  if (reason === 'ingesting') await query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','running')", [libraryId]);
  if (reason === 'backfilling') await query("INSERT INTO task_queue(task_type,payload,status) VALUES ('metadata_enrichment','{}','processing')");
  await expect(maintain(await claim(taskId))).resolves.toEqual({ status: 'deferred', reason });
  expect((await state()).attempts).toBe(0);
  expect((await jobs())[0]).toMatchObject({ status: 'pending', attempts: 0, claim_token: null });
  expect(new Date((await jobs())[0].next_retry_at).getTime() - Date.now()).toBeGreaterThan(890000);
  expect((await inspectImageIndexes(query)).every(value => value.action === 'create')).toBe(true);
});

test('crashed attempts retain cooldown and cap even if queue attempt counters never advanced', async () => {
  const { taskId } = await reconcile();
  const failingDb = { pool: { connect: async () => {
    const client = await getPool().connect();
    return { on: (...args) => client.on(...args), removeListener: (...args) => client.removeListener(...args),
      release: discard => client.release(discard), query: (sql, params) => {
        if (sql === IMAGE_INDEXES[0].create) throw new Error('simulated_interruption_after_reservation');
        return client.query(sql, params);
      } };
  } } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    await query("UPDATE image_index_reconciliation_state SET next_attempt_at = NOW() - INTERVAL '1 second'");
    await expect(runImageIndexMaintenance({ database: failingDb, task: await claim(taskId) })).rejects.toThrow('simulated_interruption');
    expect((await state()).attempts).toBe(attempt);
    if (attempt < 3) await expect(maintain(await claim(taskId))).resolves.toMatchObject({ status: 'deferred', reason: 'cooldown' });
  }
  await expect(maintain(await claim(taskId))).resolves.toMatchObject({ status: 'review' });
  expect((await jobs())[0]).toMatchObject({ status: 'failed', error_message: 'image_index_review_required', attempts: 0 });
  await expect(reconcile()).resolves.toMatchObject({ status: 'review', reason: 'repair_unverified' });
  await query('DELETE FROM task_queue');
  await expect(reconcile()).resolves.toMatchObject({ status: 'review', reason: 'repair_unverified' });
  expect(await jobs()).toEqual([]); expect((await state()).attempts).toBe(3);
});

test('a lost episode terminates the automatic job instead of falling back to manual authority', async () => {
  const { taskId } = await reconcile(); await query('DELETE FROM image_index_reconciliation_state');
  await expect(maintain(await claim(taskId))).resolves.toMatchObject({ status: 'review' });
  expect((await jobs())[0].status).toBe('failed');
  expect((await inspectImageIndexes(query)).every(value => value.action === 'create')).toBe(true);
});

test('transaction failure rolls back both task and state', async () => {
  const database = { pool: { connect: async () => {
    const client = await getPool().connect();
    return { on: (...args) => client.on(...args), removeListener: (...args) => client.removeListener(...args),
      release: discard => client.release(discard), query: (sql, params) => {
        if (sql.startsWith('INSERT INTO public.image_index')) throw new Error('synthetic_ledger_write_failure');
        return client.query(sql, params);
      } };
  } } };
  await expect(reconcileImageIndexes({ database })).rejects.toThrow('synthetic_ledger_write_failure');
  expect(await jobs()).toEqual([]); expect(await state()).toBeUndefined();
  expect((await reconcile()).reason).toBe('repair_needed');
});

test.each([RUNTIME_MAINTENANCE_LOCK_KEY, IMAGE_INDEX_LOCK_KEY])('admission lock %s prevents producer writes', async key => {
  const client = await getPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [key]);
    expect((await reconcile()).status).toBe('deferred'); expect(await jobs()).toEqual([]);
  } finally { client.release(true); }
});
test('restore quarantine and unexpected definitions never queue or drop indexes', async () => {
  await query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'requires_maintenance' WHERE gate_id = 1");
  try { expect((await reconcile()).reason).toBe('restore_verification_required'); }
  finally { await query("UPDATE policy_native_intent_reconciliation_restore_gates SET gate_state = 'ready' WHERE gate_id = 1"); }
  await query('CREATE INDEX idx_embeddings_image_hash ON classification_embeddings (image_model)');
  await expect(reconcile()).resolves.toEqual({ status: 'review', reason: 'definition_mismatch' });
  expect(await jobs()).toEqual([]);
  expect((await query("SELECT pg_get_indexdef('public.idx_embeddings_image_hash'::regclass) AS definition")).rows[0].definition).toContain('(image_model)');
});

test('cancelled real build is unhealthy, detected and repaired automatically', async () => {
  const writer = await getPool().connect(), builder = await getPool().connect(); let build;
  try {
    await writer.query('BEGIN'); await writer.query('LOCK TABLE classification_embeddings IN ROW EXCLUSIVE MODE');
    const pid = (await builder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    build = builder.query(IMAGE_INDEXES[0].create).then(() => null, error => error);
    let appeared = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await query("SELECT to_regclass('public.idx_embeddings_image_hnsw') AS index")).rows[0].index) { appeared = true; break; }
      await new Promise(resolve => { setTimeout(resolve, 20); });
    }
    expect(appeared).toBe(true); await query('SELECT pg_cancel_backend($1)', [pid]); expect((await build).code).toBe('57014');
    await writer.query('ROLLBACK');
    expect((await checkRAG({})).indexes.image).toBe(false);
    const result = await reconcile(); expect(result).toMatchObject({ missing: 2, invalid: 1 });
    await expect(maintain(await claim(result.taskId))).resolves.toMatchObject({ status: 'complete', repaired: 1, created: 2 });
    expect((await checkRAG({})).indexes.image).toBe(true);
  } finally { await writer.query('ROLLBACK'); writer.release(true); builder.release(true); if (build) await build; }
}, 15000);
