/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createQueueMetadataCheckService } from '../../services/queueMetadataCheckService.mjs';

let db, actorId, taskId, provider, service;
beforeEach(async () => {
  db = getPool();
  actorId = (await db.query("INSERT INTO users(username,password_hash,role) VALUES ($1,'fixture','admin') RETURNING id", [randomUUID()])).rows[0].id;
  taskId = (await db.query(`INSERT INTO task_queue(task_type,payload,status,current_stage,error_message,attempts)
    VALUES ('classification','{"tmdb_id":42,"media_type":"movie"}','failed','metadata_fetch','task_metadata_not_found',1) RETURNING id`)).rows[0].id;
  provider = { configured: true, revision: 'one', getDetails: jest.fn().mockResolvedValue({ id: 42, title: 'Fixture' }) };
  service = createQueueMetadataCheckService({ db, readProvider: async () => provider });
});
afterEach(async () => {
  await db.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
  await db.query('DELETE FROM users WHERE id=$1', [actorId]);
});
const read = async () => (await db.query('SELECT * FROM task_queue WHERE id=$1', [taskId])).rows[0];
test('successful and missing-record checks preserve every task column', async () => {
  const before = await read();
  expect((await service.check(actorId, taskId, {})).observation.category).toBe('available');
  expect(await read()).toEqual(before);
  provider.getDetails.mockRejectedValue({ response: { status: 404 } });
  expect((await service.check(actorId, taskId, {})).observation.category).toBe('not_found');
  expect(await read()).toEqual(before);
});
test('PostgreSQL row revision detects a concurrent task update during provider I/O', async () => {
  provider.getDetails.mockImplementation(async () => {
    await db.query('UPDATE task_queue SET priority=priority+1 WHERE id=$1', [taskId]);
    return { id: 42, title: 'Late' };
  });
  await expect(service.check(actorId, taskId, {})).rejects.toMatchObject({ statusCode: 409 });
  expect(await read()).toMatchObject({ status: 'failed', attempts: 1, priority: 1 });
});
test('a concurrently revoked actor cannot receive evidence', async () => {
  provider.getDetails.mockImplementation(async () => {
    await db.query('UPDATE users SET is_active=false WHERE id=$1', [actorId]);
    return { id: 42, title: 'Late' };
  });
  await expect(service.check(actorId, taskId, {})).rejects.toMatchObject({ statusCode: 403 });
});
