/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { createImageIndexProgressService } from '../../services/imageIndexProgressService.mjs';
import { IMAGE_INDEXES } from '../../services/imageIndexMaintenanceContract.mjs';
import { reconcileImageIndexes } from '../../services/imageIndexReconciliation.mjs';
const query = (...args) => getPool().query(...args);
const report = () => createImageIndexProgressService({ database: { pool: getPool() } }).getReport();
let libraryId;
beforeEach(async () => {
  await query('DELETE FROM task_queue'); await query('DELETE FROM image_index_reconciliation_state');
  await query('DELETE FROM media_server_sync_status'); await query('DELETE FROM libraries');
  await query(`UPDATE ai_provider_config SET rag_enabled = true, rag_image_weight = 0.5,
    image_embedding_provider_mode = 'separate_local', image_embedding_local_host = 'http://unused.invalid' WHERE id = 1`);
  libraryId = (await query("INSERT INTO libraries(name,external_id,media_type,is_active) VALUES ('Fixture','fixture','movie',true) RETURNING id")).rows[0].id;
  await query("INSERT INTO media_server_items(library_id,external_id,title,media_type) VALUES ($1,'item','Fixture','movie')", [libraryId]);
  for (const index of IMAGE_INDEXES) await query(index.drop.replace('CONCURRENTLY', 'CONCURRENTLY IF EXISTS'));
});
test('reads fixed catalog, real readiness and episode without enqueueing or resetting', async () => {
  expect(await report()).toMatchObject({ status: 'waiting', reason: 'awaiting_check', automatic: null });
  expect((await query('SELECT * FROM task_queue')).rows).toEqual([]);
  expect((await query('SELECT * FROM image_index_reconciliation_state')).rows).toEqual([]);
  const { taskId } = await reconcileImageIndexes({ database: { pool: getPool() } });
  await query("UPDATE image_index_reconciliation_state SET attempts = 2, next_attempt_at = NOW() + INTERVAL '1 hour'");
  const before = (await query('SELECT * FROM image_index_reconciliation_state')).rows;
  expect(await report()).toMatchObject({ reason: 'cooldown', automatic: { started: 2, limit: 3 } });
  for (const index of IMAGE_INDEXES) await query(index.create);
  expect(await report()).toMatchObject({ status: 'verified', indexes: IMAGE_INDEXES.map(index => ({ key: index.name, status: 'verified' })) });
  expect((await query('SELECT * FROM image_index_reconciliation_state')).rows).toEqual(before);
  expect((await query('SELECT status FROM task_queue WHERE id=$1', [taskId])).rows[0].status).toBe('pending');
});
test('blocked imports and pruned/failed/exhausted repairs remain distinct', async () => {
  await query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','pending')", [libraryId]);
  expect((await report()).reason).toBe('ingesting');
  await query("UPDATE media_server_sync_status SET status='completed'");
  const { taskId } = await reconcileImageIndexes({ database: { pool: getPool() } });
  await query('UPDATE image_index_reconciliation_state SET attempts=3');
  expect((await report()).reason).toBe('attempt_limit');
  await query("UPDATE task_queue SET status='failed' WHERE id=$1", [taskId]);
  expect((await report()).reason).toBe('repair_unverified');
  await query('DELETE FROM task_queue');
  expect((await report()).reason).toBe('repair_unverified');
  expect((await query('SELECT attempts FROM image_index_reconciliation_state')).rows[0].attempts).toBe(3);
});
test('unexpected definitions are preserved and never counted as verified', async () => {
  await query('CREATE INDEX idx_embeddings_image_hash ON classification_embeddings (image_model)');
  expect(await report()).toMatchObject({ status: 'needs_review', reason: 'definition_mismatch', indexes: null });
  expect((await query("SELECT to_regclass('public.idx_embeddings_image_hash') AS found")).rows[0].found).not.toBeNull();
});
test('live PostgreSQL build differs from an invalid index left after cancellation', async () => {
  const writer = await getPool().connect(), builder = await getPool().connect(); let build;
  try {
    await writer.query('BEGIN'); await writer.query('LOCK TABLE classification_embeddings IN ROW EXCLUSIVE MODE');
    const pid = (await builder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    build = builder.query(IMAGE_INDEXES[0].create).then(() => null, error => error);
    let observation;
    for (let attempt = 0; attempt < 100; attempt++) {
      observation = await report();
      if (observation.status === 'running') break;
      await new Promise(resolve => { setTimeout(resolve, 20); });
    }
    expect(observation).toMatchObject({ status: 'running', reason: 'waiting_for_database' });
    await query('SELECT pg_cancel_backend($1)', [pid]); expect((await build).code).toBe('57014');
    await writer.query('ROLLBACK');
    expect(await report()).toMatchObject({ status: 'waiting', reason: 'awaiting_check',
      indexes: expect.arrayContaining([{ key: IMAGE_INDEXES[0].name, status: 'invalid' }]) });
  } finally { writer.release(true); await build; builder.release(true); }
});
