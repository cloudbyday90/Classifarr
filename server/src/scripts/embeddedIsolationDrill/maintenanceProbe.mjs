/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import * as db from '../../config/database.mjs';
import { rebuildImageIndexes } from '../../services/queueTaskProcessorIndexing.mjs';
import { runDatabaseSchemaMaintenance } from '../../services/databaseSchemaMaintenance.mjs';
import { RUNTIME_ROLE, RESTORED_DATABASE, ADMIN_ROLE, assertProbeEnvironment } from './contract.mjs';

export async function probeMaintenance() {
  assertProbeEnvironment(process.env, { uid: process.getuid?.(), platform: process.platform }, { admin: true, restored: true });
  const identity = await db.query('SELECT current_database() AS database, session_user AS username');
  assert.deepEqual(identity.rows[0], { database: RESTORED_DATABASE, username: ADMIN_ROLE });
  const result = await runDatabaseSchemaMaintenance({ database: db });
  assert.equal(result.status, 'complete');
  // Actual maintenance worker, with completion observed rather than queued to normal runtime.
  await db.query('DROP INDEX IF EXISTS idx_embeddings_image_hnsw');
  await db.query('DROP INDEX IF EXISTS idx_embeddings_image_present');
  await db.query('DROP INDEX IF EXISTS idx_embeddings_image_hash');
  let completed = false;
  await rebuildImageIndexes({ id: 1, claim_token: 'synthetic' }, {
    db, logger: { info() {} }, completeTask: async (_id, value) => { completed = value.rebuilt; },
  });
  assert.equal(completed, true);
  const indexes = await db.query(`SELECT count(*)::int AS count FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid WHERE i.indisvalid
    AND c.relname IN ('idx_embeddings_image_hnsw', 'idx_embeddings_image_present', 'idx_embeddings_image_hash')`);
  assert.equal(indexes.rows[0].count, 3);
  const sentinel = await db.query('SELECT value FROM isolation_sentinel WHERE id = 1');
  assert.equal(sentinel.rows[0].value, 'preserved');
  await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RUNTIME_ROLE}`);
  await db.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${RUNTIME_ROLE}`);
}

if (import.meta.main) {
  try { await probeMaintenance(); }
  finally { await db.pool.end(); }
}
