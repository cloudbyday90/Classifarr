/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { classificationMoveRevision, moveBlocked } from '../../services/reclassificationMoveContract.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const db = await import('../../config/database.mjs');
const { ReclassificationService } = await import('../../services/reclassificationService.mjs');
const { ReclassificationBatchService } = await import('../../services/reclassificationBatchService.mjs');
const { createBatchCoordinator } = await import('../../services/reclassificationBatchCoordinator.mjs');
const { createBatchCoordinatorRepository } = await import('../../services/reclassificationBatchCoordinatorRepository.mjs');
const { createReclassificationMoveRepository } = await import('../../services/reclassificationMoveRepository.mjs');
let libraries, rows, batch, batches, adapter, service, repository, moves;
const tick = () => createBatchCoordinator({ database: db, service }).runOnce();
const due = () => db.query('UPDATE reclassification_batches SET next_attempt_at=NOW()');

beforeEach(async () => {
  libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES ('Coordinator A','coordinator-a','movie'),('Coordinator B','coordinator-b','movie') RETURNING id`)).rows.map(row => row.id);
  rows = (await db.query(`INSERT INTO classification_history(title,tmdb_id,media_type,library_id,status)
    VALUES ('Coordinator synthetic A',961001,'movie',$1,'completed'),
      ('Coordinator synthetic B',961002,'movie',$1,'completed') RETURNING *`, [libraries[0]])).rows;
  adapter = {
    prepare: jest.fn(async row => ({ mediaType: row.media_type, configId: 1, remoteId: row.id,
      originalLibraryId: libraries[0], targetLibraryId: libraries[1], classificationStatus: row.status,
      classificationRevision: classificationMoveRevision(row),
      oldPath: `/synthetic/old/${row.id}`, newPath: `/synthetic/new/${row.id}`,
      localOldPath: `/synthetic/old/${row.id}`, localNewPath: `/synthetic/new/${row.id}` })),
    moveFiles: jest.fn(), reconcile: jest.fn(),
  };
  service = new ReclassificationService({ database: db, adapter, scan: jest.fn() });
  batches = new ReclassificationBatchService({ reclassificationService: service });
  repository = createBatchCoordinatorRepository(db);
  moves = createReclassificationMoveRepository(db);
  batch = await batches.createBatch(rows.map(row => ({ classificationId: row.id, targetLibraryId: libraries[1] })));
});
afterEach(async () => {
  await db.query('DELETE FROM reclassification_batches');
  await db.query('DELETE FROM reclassification_move_operations');
  await db.query('DELETE FROM classification_history WHERE id=ANY($1::integer[])', [rows.map(row => row.id)]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries]);
});

test('saved intent survives a fresh coordinator, one item per tick, no browser needed', async () => {
  expect((await batches.executeBatch(batch.id)).status).toBe('executing');
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  expect(await tick()).toEqual({ status: 'completed' });
  expect((await batches.getBatchStatus(batch.id)).progress.completed).toBe(1);
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
  await due();
  await tick();
  await due();
  await tick();
  const finished = await batches.getBatchStatus(batch.id);
  expect(finished.status).toBe('completed');
  expect(finished.progress).toMatchObject({ completed: 2, remaining: 0 });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(2);
});
test('repeated execute requests do not reset backoff or duplicate work', async () => {
  await batches.executeBatch(batch.id);
  await tick();
  const first = await batches.getBatchStatus(batch.id);
  await batches.executeBatch(batch.id);
  expect((await batches.getBatchStatus(batch.id)).next_attempt_at).toEqual(first.next_attempt_at);
  expect(await tick()).toEqual({ status: 'idle' });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
});
test.each(['paused', 'cancelled'])('restart preserves %s intent', async status => {
  await batches.executeBatch(batch.id);
  if (status === 'paused') await batches.pauseBatch(batch.id);
  else await batches.cancelBatch(batch.id);
  await due();
  expect(await tick()).toEqual({ status: 'idle' });
  expect((await batches.getBatchStatus(batch.id)).status).toBe(status);
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  if (status === 'cancelled') await expect(batches.resumeBatch(batch.id)).rejects.toMatchObject({ status: 409 });
});
test('restart before journal reservation safely retries a modern claim', async () => {
  await batches.executeBatch(batch.id);
  await repository.claim(); // durable crash boundary: no file effects yet
  await due();
  await tick();
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
  expect((await batches.getBatchStatus(batch.id)).progress.completed).toBe(1);
});
test('legacy executing item without evidence is not automatically moved', async () => {
  await batches.executeBatch(batch.id);
  await db.query("UPDATE reclassification_batch_items SET status='executing' WHERE id=$1", [batch.items[0].id]);
  expect(await tick()).toEqual({ status: 'needs_attention' });
  const result = await batches.getBatchStatus(batch.id);
  expect(result.status).toBe('paused');
  expect(result.items[0].error_message).toContain('Inspect');
  expect(adapter.moveFiles).not.toHaveBeenCalled();
});
test('restart with a reserved move reconciles the exact attempt, never recopies', async () => {
  await batches.executeBatch(batch.id);
  const claim = await repository.claim();
  const plan = await adapter.prepare(rows[0]);
  const operation = await moves.reserve(rows[0].id, libraries[1], 'user', plan, claim.item.id);
  await due();
  expect(await tick()).toEqual({ status: 'completed' });
  const result = await batches.getBatchStatus(batch.id);
  expect(result.items[0].execution_result).toMatchObject({ moveOperationId: operation.id, moveReconciled: true });
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  await due();
  await tick();
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1); // only the remaining item
});
test('bound journal backoff is respected; future receipt remains executing', async () => {
  await batches.executeBatch(batch.id);
  const { item } = await repository.claim();
  const operation = await moves.reserve(rows[0].id, libraries[1], 'user', await adapter.prepare(rows[0]), item.id);
  await db.query("UPDATE reclassification_move_operations SET next_attempt_at=NOW()+INTERVAL '1 hour' WHERE id=$1", [operation.id]);
  await due();
  expect(await tick()).toEqual({ status: 'waiting' });
  expect(adapter.reconcile).not.toHaveBeenCalled();
  expect((await batches.getBatchStatus(batch.id)).items[0].status).toBe('executing');
});
test.each(['missing', 'malformed', 'mismatched'])('%s receipt fails closed without replay', async kind => {
  await batches.executeBatch(batch.id);
  const { item } = await repository.claim();
  let id = kind === 'malformed' ? 'not-a-uuid' : randomUUID();
  if (kind === 'mismatched') {
    const operation = await moves.reserve(rows[1].id, libraries[1], 'user', await adapter.prepare(rows[1]));
    id = operation.id;
  }
  await db.query('UPDATE reclassification_batch_items SET execution_result=$2 WHERE id=$1',
    [item.id, JSON.stringify({ moveOperationId: id })]);
  await due();
  expect(await tick()).toEqual({ status: 'failed' });
  expect((await batches.getBatchStatus(batch.id)).status).toBe('paused');
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  expect(adapter.reconcile).not.toHaveBeenCalled();
});
test.each(['pause', 'cancel'])('%s during preparation fences admission and competing workers', async action => {
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  const prepare = adapter.prepare.getMockImplementation();
  adapter.prepare.mockImplementationOnce(async row => { entered.resolve(); await release.promise; return prepare(row); });
  await batches.executeBatch(batch.id);
  const running = tick();
  await entered.promise;
  try {
    expect(await tick()).toEqual({ status: 'busy' });
    if (action === 'pause') await batches.pauseBatch(batch.id);
    else await batches.cancelBatch(batch.id);
  } finally { release.resolve(); }
  expect(await running).toEqual({ status: 'stopped' });
  expect(adapter.moveFiles).not.toHaveBeenCalled();
  expect((await db.query('SELECT id FROM reclassification_move_operations')).rows).toHaveLength(0);
  expect((await batches.getBatchStatus(batch.id)).items[0].status).toBe(action === 'pause' ? 'validated' : 'cancelled');
});
test('explicit retry of inspected evidence reconciles without repeating physical movement', async () => {
  adapter.reconcile.mockRejectedValueOnce(moveBlocked('move_source_remains', 'Inspect both folders.'));
  await batches.executeBatch(batch.id);
  await tick();
  expect((await batches.getBatchStatus(batch.id)).status).toBe('paused');
  await batches.retryItem(batch.id, batch.items[0].id);
  await batches.resumeBatch(batch.id);
  expect(await tick()).toEqual({ status: 'completed' });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
});
test('validation cannot reset running or completed items', async () => {
  await batches.executeBatch(batch.id);
  await expect(batches.validateBatch(batch.id)).rejects.toMatchObject({ status: 409 });
  await tick();
  expect((await batches.getBatchStatus(batch.id)).items[0].status).toBe('completed');
});
test('busy move lock defers without consuming or failing an item', async () => {
  await batches.executeBatch(batch.id);
  await db.withSessionAdvisoryLock(db.DB_ADVISORY_LOCKS.RECLASSIFICATION_MOVE, async () => {
    expect(await tick()).toEqual({ status: 'busy' });
  });
  expect((await batches.getBatchStatus(batch.id)).progress.failed).toBe(0);
  await due();
  expect(await tick()).toEqual({ status: 'completed' });
});

test.each(['completed','cancelled'])('retry cannot strand pending work in a %s batch', async status => {
  await db.query('UPDATE reclassification_batches SET status=$1 WHERE id=$2', [status, batch.id]);
  await db.query("UPDATE reclassification_batch_items SET status='failed' WHERE batch_id=$1", [batch.id]);
  await batches.retryItem(batch.id, batch.items[0].id);
  await batches.skipItem(batch.id, batch.items[0].id);
  expect((await batches.getBatchStatus(batch.id)).items[0].status).toBe('failed');
});

test('the migration upgrades populated legacy tables without authorizing legacy claims', async () => {
  const sql = await readFile(new URL('../../../../database/migrations/20260924_190000_add_reclassification_batch_coordinator.sql', import.meta.url), 'utf8');
  await db.withTransaction(async client => {
    await client.query('CREATE SCHEMA batch_upgrade_fixture');
    await client.query('SET LOCAL search_path TO batch_upgrade_fixture');
    await client.query(sql.slice(0, sql.indexOf('ALTER TABLE')));
    await client.query("INSERT INTO reclassification_batches(id,status) VALUES(1,'paused'),(2,'executing')");
    await client.query(`INSERT INTO reclassification_batch_items(batch_id,classification_id,target_library_id,status,execution_order)
      VALUES(2,1,2,'executing',1)`);
    await client.query(sql);
    await client.query(sql); // replay-safe additive migration
    expect((await client.query('SELECT status FROM reclassification_batches ORDER BY id')).rows)
      .toEqual([{ status: 'paused' }, { status: 'executing' }]);
    expect((await client.query('SELECT execution_version FROM reclassification_batch_items')).rows[0].execution_version).toBeNull();
  });
});
test.each(['movie','tv'])('coordinator keeps %s execution within the existing move service', async mediaType => {
  await db.query('UPDATE libraries SET media_type=$1 WHERE id=ANY($2::integer[])', [mediaType, libraries]);
  await db.query('UPDATE classification_history SET media_type=$1 WHERE id=ANY($2::integer[])', [mediaType, rows.map(row => row.id)]);
  await batches.executeBatch(batch.id);
  expect(await tick()).toEqual({ status: 'completed' });
  expect(adapter.prepare.mock.calls[0][0].media_type).toBe(mediaType);
});
test('completed journal receipt repairs an interrupted item without history mutation', async () => {
  await batches.executeBatch(batch.id);
  await tick();
  await db.query("UPDATE reclassification_batch_items SET status='executing' WHERE id=$1", [batch.items[0].id]);
  await due();
  expect(await tick()).toEqual({ status: 'completed' });
  expect(adapter.moveFiles).toHaveBeenCalledTimes(1);
  expect(adapter.reconcile).toHaveBeenCalledTimes(1);
  expect((await batches.getBatchStatus(batch.id)).items[0].execution_result.moveReconciled).toBe(true);
});
