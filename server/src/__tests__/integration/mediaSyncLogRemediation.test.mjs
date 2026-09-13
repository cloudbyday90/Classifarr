/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { getPool, createIntegrationTestApp } from './setup.mjs';
import { MediaSourceObservationStore } from '../../services/mediaSourceObservationStore.mjs';
import { createMediaSyncLogRemediation } from '../../services/mediaSyncLogRemediation.mjs';
import { createPlexLogItemLinks } from '../../services/plexLogItemLinks.mjs';
import { createLogsRouter } from '../../routes/logsRouteShared.mjs';

let pool, serverId, libraryId, errorId, app, testConnection;
const machineIdentifier = 'b'.repeat(40);
beforeEach(async () => {
  pool = getPool();
  serverId = (await pool.query("INSERT INTO media_server(type,name,url,api_key) VALUES ('plex',$1,'http://fixture.invalid','private-token') RETURNING id", [randomUUID()])).rows[0].id;
  libraryId = (await pool.query("INSERT INTO libraries(name,external_id,media_type,media_server_id,is_active) VALUES ('Fixture library',$1,'movie',$2,true) RETURNING id", [randomUUID(), serverId])).rows[0].id;
  const store = new MediaSourceObservationStore({ withTransaction: async fn => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  } });
  const context = await store.start(serverId, libraryId);
  await store.capture(context, [
    { external_id: '123', title: 'Fixture movie', year: 2006, media_type: 'movie', provider_identity_invalid: true,
      provider_identity_issue: 'conflicting_provider_ids', provider_identity_field: 'tmdb_id' },
    { external_id: '456', title: 'Fixture show', year: 2010, media_type: 'tv', provider_identity_invalid: true,
      provider_identity_issue: 'conflicting_provider_ids', provider_identity_field: 'tvdb_id' },
  ]);
  await store.finish(context);
  errorId = (await pool.query(`INSERT INTO error_log(level,module,message,metadata)
    VALUES ('WARN','mediaSync','Library sync skipped source items',$1::jsonb) RETURNING error_id`,
  [JSON.stringify({ libraryId, identityIssueCounts: { conflicting_provider_ids: 2 }, reference: { url: 'old-forum' } })])).rows[0].error_id;
  testConnection = jest.fn().mockResolvedValue({ success: false });
  const enrichLog = createMediaSyncLogRemediation({ query: (...args) => pool.query(...args), resolveLinks: createPlexLogItemLinks({ testConnection }) });
  app = createIntegrationTestApp({ basePath: '/api/logs', router: createLogsRouter({ express, db: pool,
    rateLimit: () => (_req, _res, next) => next(), logger: { error: jest.fn(), info: jest.fn() }, enrichLog,
    authenticateToken: (req, res, next) => req.headers.authorization ? next() : res.sendStatus(401),
    requireAdmin: (req, res, next) => req.headers.authorization === 'Bearer admin-fixture' ? next() : res.sendStatus(403),
  }) });
});
afterEach(async () => {
  await pool.query('DELETE FROM error_log WHERE error_id=$1', [errorId]);
  await pool.query('DELETE FROM libraries WHERE id=$1', [libraryId]);
  await pool.query('DELETE FROM media_server WHERE id=$1', [serverId]);
});
const read = suffix => request(app).get(`/api/logs/error/${errorId}${suffix}`).set('Authorization', 'Bearer admin-fixture');

test('old warning gains current titles, steps and links after Plex restart without writing a second log', async () => {
  const offline = await read('');
  expect(offline.status).toBe(200); expect(offline.headers['cache-control']).toBe('private, no-store');
  expect(offline.body.remediation.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'Fixture movie', mediaType: 'Movie', plexUrl: null }),
    expect.objectContaining({ title: 'Fixture show', mediaType: 'TV show', plexUrl: null }),
  ]));
  testConnection.mockResolvedValue({ success: true, data: { MediaContainer: { machineIdentifier } } });
  const online = await read('');
  expect(online.body.error_id).toBe(errorId); expect(online.body.remediation.linkStatus).toBe('complete');
  const copied = await read('/report');
  expect(copied.headers['cache-control']).toBe('private, no-store');
  expect(copied.body.report).toContain('Fixture movie'); expect(copied.body.report).toContain('Fixture show');
  expect(copied.body.report).toContain('Fix Match'); expect(copied.body.report).toContain('Refresh Metadata');
  expect(copied.body.report).toContain(`app.plex.tv/desktop/#!/server/${machineIdentifier}/details?key=%2Flibrary%2Fmetadata%2F456`);
  expect(copied.body.report).not.toMatch(/old-forum|private-token|fixture.invalid/);
  const saved = (await pool.query('SELECT metadata,resolved FROM error_log WHERE error_id=$1', [errorId])).rows[0];
  expect(saved.metadata.reference.url).toBe('old-forum'); expect(saved.resolved).toBe(false);
});

test('authentication and administrator authorization run before link resolution', async () => {
  expect((await request(app).get(`/api/logs/error/${errorId}`)).status).toBe(401);
  expect((await request(app).get(`/api/logs/error/${errorId}/report`).set('Authorization', 'Bearer viewer')).status).toBe(403);
  expect(testConnection).not.toHaveBeenCalled();
});

test.each(['expired', 'new_observation', 'inactive', 'different_owner', 'different_type'])('never attaches unrelated or stale records: %s', async reason => {
  if (reason === 'expired') await pool.query("UPDATE media_source_observations SET last_seen_at=now()-interval '31 days' WHERE library_id=$1", [libraryId]);
  if (reason === 'new_observation') await pool.query("UPDATE error_log SET created_at=now()-interval '1 day' WHERE error_id=$1", [errorId]);
  if (reason === 'inactive') await pool.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraryId]);
  if (reason === 'different_type') await pool.query("UPDATE media_server SET type='jellyfin' WHERE id=$1", [serverId]);
  // Use an explicitly different, positive owner rather than relying on sequence IDs.
  if (reason === 'different_owner') await pool.query("UPDATE error_log SET metadata=metadata || jsonb_build_object('mediaServerId',$2::int) WHERE error_id=$1", [errorId, serverId + 1]);
  const result = await read('');
  expect(result.status).toBe(200); expect(result.body.remediation.status).toBe('no_current_records');
  expect(testConnection).not.toHaveBeenCalled();
});
