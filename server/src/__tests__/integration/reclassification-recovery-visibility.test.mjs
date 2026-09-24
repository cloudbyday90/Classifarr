/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeAll, beforeEach, afterEach, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';
import { classificationMoveRevision } from '../../services/reclassificationMoveContract.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { ReclassificationService } = await import('../../services/reclassificationService.mjs');
const { reclassificationBatchService: batches } = await import('../../services/reclassificationBatchService.mjs');
const { registerHistoryRoutes } = await import('../../routes/classificationRouteHistory.mjs');
const router = express.Router();
registerHistoryRoutes(router, { db });
const app = createIntegrationTestApp({ basePath: '/history-test', router });
let libraries, classification, batch, adapter, service, available;

beforeAll(async () => { await batches.ensureTables(); });
beforeEach(async () => {
  libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES ('Visibility A','visibility-a','movie'),('Visibility B','visibility-b','movie') RETURNING id`)).rows.map(row => row.id);
  classification = (await db.query(`INSERT INTO classification_history(title,tmdb_id,media_type,library_id,status,confidence)
    VALUES ('Recovery visibility synthetic', 960024, 'movie', $1, 'completed', 45) RETURNING *`, [libraries[0]])).rows[0];
  available = false;
  adapter = {
    prepare: jest.fn(async row => ({ mediaType: 'movie', configId: 1, remoteId: 2,
      originalLibraryId: libraries[0], targetLibraryId: libraries[1], classificationStatus: row.status,
      classificationRevision: classificationMoveRevision(row), oldPath: '/private/old', newPath: '/private/new',
      localOldPath: '/private/old', localNewPath: '/private/new' })),
    moveFiles: jest.fn(),
    reconcile: jest.fn(async () => { if (!available) throw new Error('synthetic offline'); }),
  };
  service = new ReclassificationService({ database: db, adapter, scan: jest.fn() });
  batches.reclassificationService = service;
  batch = await batches.createBatch([{ classificationId: classification.id, targetLibraryId: libraries[1] }]);
});
afterEach(async () => {
  await db.query('DELETE FROM reclassification_batches');
  await db.query('DELETE FROM reclassification_move_operations');
  await db.query('DELETE FROM classification_history WHERE id=$1', [classification.id]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries]);
});
const recover = async () => {
  available = true;
  await db.query('UPDATE reclassification_move_operations SET next_attempt_at=NOW()');
  return service.recoverDue();
};

test('outage recovery reconciles exact batch receipt and history, leaving the batch paused', async () => {
  const failed = await batches.executeBatch(batch.id);
  expect(failed.status).toBe('paused');
  expect(failed.progress.failed).toBe(1);
  const operationId = failed.items[0].execution_result.moveOperationId;
  expect(failed.items[0].move_recovery).toMatchObject({ operationId, state: 'moving' });
  expect(await recover()).toEqual({ status: 'completed' });
  const completed = await batches.getBatchStatus(batch.id);
  expect(completed.status).toBe('paused');
  expect(completed.progress).toMatchObject({ completed: 1, failed: 0, remaining: 0 });
  expect(completed.items[0]).toMatchObject({ status: 'completed', error_message: null,
    execution_result: { moveOperationId: operationId, moveReconciled: true, success: true } });
  expect((await batches.getBatchProgress(batch.id)).progress).toEqual(completed.progress);
  expect((await batches.listBatches())[0].progress).toEqual(completed.progress);
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
  const history = await request(app).get(`/history-test/history/${classification.id}`);
  expect(history.status).toBe(200);
  expect(history.headers['cache-control']).toBe('no-store');
  expect(history.body).toMatchObject({ status: 'reclassified', confidence: classification.confidence,
    move_recovery: { operationId, state: 'completed', nextAttemptAt: null } });
  const page = await request(app).get('/history-test/history');
  expect(page.status).toBe(200);
  expect(page.headers['cache-control']).toBe('no-store');
  expect(page.body.data.find(row => row.id === classification.id).move_recovery.state).toBe('completed');
  expect(JSON.stringify(history.body.move_recovery)).not.toMatch(/private|plan|corrected_by|contentDigest/);
  // The compact completion receipt outlives journal detail retention.
  await db.query("UPDATE reclassification_move_operations SET completed_at=NOW()-INTERVAL '31 days'");
  await service.recoverDue();
  const retained = await batches.getBatchStatus(batch.id);
  expect(retained.items[0].move_recovery).toBeNull();
  expect(retained.items[0].execution_result.moveReconciled).toBe(true);
  expect(retained.progress.completed).toBe(1);
});

test.each(['cancelled', 'skipped', 'retry'])('recovery respects %s intent and does not double count', async intent => {
  await batches.executeBatch(batch.id);
  const itemId = batch.items[0].id;
  if (intent === 'cancelled') await batches.cancelBatch(batch.id);
  if (intent === 'skipped') { await batches.skipItem(batch.id, itemId); await batches.skipItem(batch.id, itemId); }
  if (intent === 'retry') await batches.retryItem(batch.id, itemId);
  await recover();
  const result = await batches.getBatchStatus(batch.id);
  expect(result.status).toBe(intent === 'cancelled' ? 'cancelled' : 'paused');
  expect(result.items[0].status).toBe(intent === 'skipped' ? 'skipped' : 'completed');
  expect(result.progress).toMatchObject({ failed: 0, completed: intent === 'skipped' ? 0 : 1,
    skipped: intent === 'skipped' ? 1 : 0, remaining: 0 });
  await batches.retryItem(batch.id, itemId);
  expect((await batches.getBatchStatus(batch.id)).items[0].status).toBe(result.items[0].status);
});

test('a different attempt reference is never marked completed', async () => {
  await batches.executeBatch(batch.id);
  await db.query(`UPDATE reclassification_batch_items SET execution_result=$1 WHERE id=$2`,
    [JSON.stringify({ moveOperationId: randomUUID() }), batch.items[0].id]);
  await recover();
  const result = await batches.getBatchStatus(batch.id);
  expect(result.items[0].status).toBe('failed');
  expect(result.items[0].move_recovery).toBeNull();
});

test('binding failure rolls back reservation before file work', async () => {
  await expect(service.executeReclassification({ classificationId: classification.id, targetLibraryId: libraries[1],
    batchItemId: batch.items[0].id })).rejects.toMatchObject({ code: 'move_batch_changed' });
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  expect((await db.query('SELECT id FROM reclassification_move_operations')).rows).toHaveLength(0);
});

test.each(['paused', 'cancelled'])('runner stops claiming items and preserves %s during an admitted move', async status => {
  const second = (await db.query(`INSERT INTO reclassification_batch_items
    (batch_id,classification_id,target_library_id,execution_order) VALUES($1,$2,$3,2) RETURNING id`,
  [batch.id, classification.id, libraries[1]])).rows[0];
  available = true;
  adapter.reconcile.mockImplementationOnce(async () => {
    if (status === 'paused') await batches.pauseBatch(batch.id);
    else await batches.cancelBatch(batch.id);
  });
  const result = await batches.executeBatch(batch.id);
  expect(result.status).toBe(status);
  expect(result.items.find(item => item.id === second.id).status).toBe(status === 'paused' ? 'pending' : 'cancelled');
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
  if (status === 'cancelled') await expect(batches.resumeBatch(batch.id)).rejects.toMatchObject({ status: 409 });
});

test('completion receipt failure rolls back history and journal and recovers later', async () => {
  const transaction = db.withTransaction;
  let fail = true;
  const database = { ...db, withTransaction: callback => transaction(client => callback({
    query: (sql, values) => {
      if (fail && sql.includes("'moveReconciled', true")) { fail = false; throw new Error('synthetic receipt outage'); }
      return client.query(sql, values);
    },
  })) };
  service = new ReclassificationService({ database, adapter, scan: jest.fn() });
  batches.reclassificationService = service;
  available = true;
  const result = await batches.executeBatch(batch.id);
  expect(result.items[0].status).toBe('failed');
  expect((await db.query('SELECT library_id FROM classification_history WHERE id=$1', [classification.id])).rows[0].library_id).toBe(libraries[0]);
  await recover();
  expect((await batches.getBatchStatus(batch.id)).progress).toMatchObject({ completed: 1, failed: 0 });
});
