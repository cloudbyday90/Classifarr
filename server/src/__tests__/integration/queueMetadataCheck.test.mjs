/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { createQueueMetadataCheckService } from '../../services/queueMetadataCheckService.mjs';

let db, actorId, taskId, sourceId, provider, service;
beforeEach(async () => {
  db = getPool();
  sourceId = null;
  actorId = (await db.query("INSERT INTO users(username,password_hash,role) VALUES ($1,'fixture','admin') RETURNING id", [randomUUID()])).rows[0].id;
  taskId = (await db.query(`INSERT INTO task_queue(task_type,payload,status,current_stage,error_message,attempts)
    VALUES ('classification','{"tmdb_id":42,"media_type":"movie"}','failed','metadata_fetch','task_metadata_not_found',1) RETURNING id`)).rows[0].id;
  provider = { configured: true, revision: 'one', getDetails: jest.fn().mockResolvedValue({ id: 42, title: 'Fixture' }) };
  service = createQueueMetadataCheckService({ db, readProvider: async () => provider });
});
afterEach(async () => {
  await db.query('DELETE FROM task_queue WHERE id=$1', [taskId]);
  if (sourceId) await db.query('DELETE FROM webhook_log WHERE id=$1', [sourceId]);
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

async function linkedSource() {
  sourceId = (await db.query(`INSERT INTO webhook_log(webhook_type,payload,tmdb_id,media_type)
    VALUES ('fixture','{"media":{"imdbId":"tt123"},"private":"not exposed"}',42,'movie') RETURNING id`)).rows[0].id;
  await db.query('UPDATE task_queue SET webhook_log_id=$1 WHERE id=$2', [sourceId, taskId]);
  provider.getDetails.mockRejectedValueOnce({ response: { status: 404 } }).mockResolvedValue({ id: 99, title: 'Candidate' });
  provider.findByExternalId = jest.fn().mockResolvedValue({ movie_results: [{ id: 99 }] });
  provider.getExternalIds = jest.fn().mockResolvedValue({ id: 99, imdb_id: 'tt123' });
}

test('linked JSON identity evidence leaves every task and source column unchanged', async () => {
  await linkedSource();
  const before = await read();
  const beforeSource = (await db.query('SELECT * FROM webhook_log WHERE id=$1', [sourceId])).rows[0];
  const result = await service.check(actorId, taskId, {});
  expect(result.identityEvidence).toMatchObject({ reason: 'candidate_for_review', candidate: { tmdbId: 99 } });
  expect(JSON.stringify(result)).not.toContain('not exposed');
  expect(await read()).toEqual(before);
  expect((await db.query('SELECT * FROM webhook_log WHERE id=$1', [sourceId])).rows[0]).toEqual(beforeSource);
});

test.each(['update', 'delete'])('a concurrent source %s invalidates the candidate', async change => {
  await linkedSource();
  provider.getExternalIds.mockImplementation(async () => {
    if (change === 'update') await db.query("UPDATE webhook_log SET payload='{}' WHERE id=$1", [sourceId]);
    else await db.query('DELETE FROM webhook_log WHERE id=$1', [sourceId]);
    return { id: 99, imdb_id: 'tt123' };
  });
  await expect(service.check(actorId, taskId, {})).rejects.toMatchObject({ statusCode: 409 });
});

test('disagreeing source identity never triggers candidate lookup', async () => {
  await linkedSource();
  await db.query('UPDATE webhook_log SET tmdb_id=100 WHERE id=$1', [sourceId]);
  expect((await service.check(actorId, taskId, {})).identityEvidence.reason).toBe('source_conflict');
  expect(provider.findByExternalId).not.toHaveBeenCalled();
});

test.each([
  { media: { tmdbId: '00042', mediaType: ' Movie ' } },
  { tmdbId: 42, mediaType: 'movie' },
  { media_type: 'movie', extra: [{ name: 'TMDB ID', value: 42 }] },
])('legacy diagnostic normalizes without rewriting %j', async payload => {
  await db.query('UPDATE task_queue SET payload=$2 WHERE id=$1', [taskId, payload]);
  const before = await read();
  expect(await service.check(actorId, taskId, {})).toMatchObject({ tmdbId: 42, mediaType: 'movie', observation: { category: 'available' } });
  expect(await read()).toEqual(before);
});

test.each([
  { tmdb_id: 42, media_type: 'movie', media: { tmdbId: 99 } },
  { tmdb_id: 42, media_type: 'movie', tmdbId: true },
  { tmdb_id: 42, media_type: 'movie', private: 'x'.repeat(65536) },
])('invalid saved identities fail before HTTP', async payload => {
  await db.query('UPDATE task_queue SET payload=$2 WHERE id=$1', [taskId, payload]);
  const before = await read();
  await expect(service.check(actorId, taskId, {})).rejects.toMatchObject({ statusCode: 409 });
  expect(provider.getDetails).not.toHaveBeenCalled();
  expect(await read()).toEqual(before);
});

test.each([
  { media: { tmdbId: 99, imdbId: 'tt123' } },
  { tmdb_id: 42, media: { tmdbId: 99, imdbId: 'tt123' } },
  { media_type: null, media: { imdbId: 'tt123' } },
])('source raw identity cannot contradict its normalized columns', async payload => {
  await linkedSource();
  await db.query('UPDATE webhook_log SET payload=$2 WHERE id=$1', [sourceId, payload]);
  expect((await service.check(actorId, taskId, {})).identityEvidence.reason).toBe('source_conflict');
  expect(provider.findByExternalId).not.toHaveBeenCalled();
});
