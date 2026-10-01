/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { runImageIndexMaintenance } from '../../services/imageIndexMaintenance.mjs';
import { reconcileImageIndexes } from '../../services/imageIndexReconciliation.mjs';
import { inspectImageIndexes } from '../../services/imageIndexMaintenanceCatalog.mjs';
import { IMAGE_INDEXES } from '../../services/imageIndexMaintenanceContract.mjs';
import { INVENTORY_MAINTENANCE_IDLE_SQL } from '../../services/inventoryBackgroundReadiness.mjs';

const query = (...args) => getPool().query(...args);
const database = () => ({ pool: getPool() });
const claim = async id => (await query(`UPDATE task_queue SET status='processing',claim_token=gen_random_uuid(),
  visible_at=clock_timestamp()+INTERVAL '150 seconds' WHERE id=$1 RETURNING id,claim_token`, [id])).rows[0];

test('real large-cohort admission preserves data, attempt budget and DDL while memory or ingestion blocks', async () => {
  await query('DELETE FROM task_queue');
  await query('DELETE FROM image_index_reconciliation_state');
  await query('DELETE FROM libraries');
  for (const index of IMAGE_INDEXES) await query(index.drop.replace('CONCURRENTLY', 'CONCURRENTLY IF EXISTS'));
  await query(`UPDATE ai_provider_config SET rag_enabled=true,rag_image_weight=0.5,
    image_embedding_provider_mode='separate_local',image_embedding_local_host='http://unused.invalid' WHERE id=1`);
  const library = (await query("INSERT INTO libraries(name,external_id,media_type,is_active) VALUES ('Capacity','capacity','movie',true) RETURNING id")).rows[0];
  await query("INSERT INTO media_server_items(library_id,external_id,title,media_type) VALUES ($1,'item','Synthetic','movie')", [library.id]);
  await query(`WITH inserted AS (
    INSERT INTO classification_history(media_type,title,status,method)
    SELECT 'movie','Capacity fixture '||n,'pending','existing_media' FROM generate_series(1,10001) n RETURNING id
  ) INSERT INTO classification_embeddings(classification_id,embedding,embedding_dims,provider,model,image_embedding)
    SELECT id,array_fill(0.1::real,ARRAY[768])::vector,768,'synthetic','capacity',array_fill(0.1::real,ARRAY[2000])::vector FROM inserted`);
  const { taskId } = await reconcileImageIndexes({ database: database() });
  expect(taskId).toBeDefined();
  const readMemory = () => ({ available: 1024 ** 3 - 1, constrained: 2 * 1024 ** 3, total: 8 * 1024 ** 3 });
  // Repeated low-headroom checks must not silently consume automatic attempts.
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(runImageIndexMaintenance({ database: database(), task: await claim(taskId), readMemory }))
      .resolves.toEqual({ status: 'deferred', reason: 'image_index_memory_pressure' });
    expect((await query('SELECT attempts FROM image_index_reconciliation_state')).rows[0].attempts).toBe(0);
    expect((await inspectImageIndexes(query)).every(value => value.action === 'create')).toBe(true);
  }
  expect((await query('SELECT attempts FROM image_index_reconciliation_state')).rows[0].attempts).toBe(0);
  expect((await query('SELECT status,attempts,claim_token FROM task_queue WHERE id=$1', [taskId])).rows[0])
    .toEqual({ status: 'pending', attempts: 0, claim_token: null });
  expect((await inspectImageIndexes(query)).every(value => value.action === 'create')).toBe(true);
  expect((await query('SELECT count(*)::integer n FROM classification_embeddings')).rows[0].n).toBe(10001);

  // Manual requests still wait on legacy unfinished imports, not only automatic jobs.
  await query("UPDATE task_queue SET source='manual' WHERE id=$1", [taskId]);
  await query("INSERT INTO media_server_sync_status(library_id,sync_type,status) VALUES ($1,'full','running')", [library.id]);
  await expect(runImageIndexMaintenance({ database: database(), task: await claim(taskId), readMemory }))
    .resolves.toEqual({ status: 'deferred', reason: 'image_index_background_busy' });
  await query("UPDATE media_server_sync_status SET status='completed'");
  const other = (await query("INSERT INTO task_queue(task_type,payload,status) VALUES ('metadata_enrichment','{}','processing') RETURNING id")).rows[0];
  expect((await query(INVENTORY_MAINTENANCE_IDLE_SQL, [taskId])).rows[0].readiness).toBe('backfilling');
  await query('DELETE FROM task_queue WHERE id=$1', [other.id]);
  await query('DELETE FROM media_server_sync_status');
  await query('DELETE FROM libraries');
  // Empty setups can explicitly maintain existing embeddings; no fresh-install automatic enqueue.
  expect((await query(INVENTORY_MAINTENANCE_IDLE_SQL, [taskId])).rows[0].readiness).toBe('ready');
  expect((await inspectImageIndexes(query)).every(value => value.action === 'create')).toBe(true);
  expect((await query('SELECT attempts FROM image_index_reconciliation_state')).rows[0].attempts).toBe(0);
});
