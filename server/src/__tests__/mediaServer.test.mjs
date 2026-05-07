/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Media Server API Tests - Issue #74 Regression Prevention
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
  pool: { connect: jest.fn() },
  query: jest.fn(),
  withTransaction: jest.fn(async (fn) => {
    const conn = await mockDb.pool.connect();
    try {
      await conn.query('BEGIN');
      const result = await fn(conn);
      await conn.query('COMMIT');
      return result;
    } catch (err) {
      try { await conn.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      conn.release();
    }
  }),
};
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb, DB_ADVISORY_LOCKS: { STARTUP_RESET: 9001 } }));

const mockSyncLibrary = jest.fn().mockResolvedValue({});
const mockMediaSync = { syncLibrary: mockSyncLibrary };
jest.unstable_mockModule('../services/mediaSync.mjs', () => createMockModule(mockMediaSync));

const db = mockDb;
const { default: mediaSyncService } = await import('../services/mediaSync.mjs');
const { default: queueService } = await import('../services/queueService.mjs');
const { default: syncStatus } = await import('../services/syncStatus.mjs');
const { createMediaServerRouter } = await import('../routes/mediaServer.mjs');
const { plexService, embyService, jellyfinService } = await import('../services/mediaServers/index.mjs');

const mockPlexService = {
    testConnection: jest.fn(),
    getLibraries: jest.fn()
};

const mockEmbyService = {
    testConnection: jest.fn(),
    getLibraries: jest.fn()
};

const mockJellyfinService = {
    testConnection: jest.fn(),
    getLibraries: jest.fn()
};

const mockGetMediaServerService = jest.fn((type) => {
    switch (String(type).toLowerCase()) {
        case 'plex':
            return mockPlexService;
        case 'emby':
            return mockEmbyService;
        case 'jellyfin':
            return mockJellyfinService;
        default:
            throw new Error(`Unknown media server type: ${type}`);
    }
});

describe('Media Server API', () => {
    let app;
    let mockClient;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/media-server', createMediaServerRouter({
            expressInstance: express,
            db,
            mediaSyncService,
            queueServiceInstance: queueService,
        }));

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.pool.connect.mockResolvedValue(mockClient);

        jest.clearAllMocks();
        mockGetMediaServerService.mockClear();
        mockPlexService.testConnection.mockReset();
        mockPlexService.getLibraries.mockReset();
        mockEmbyService.testConnection.mockReset();
        mockEmbyService.getLibraries.mockReset();
        mockJellyfinService.testConnection.mockReset();
        mockJellyfinService.getLibraries.mockReset();
        plexService.testConnection = mockPlexService.testConnection;
        plexService.getLibraries = mockPlexService.getLibraries;
        embyService.testConnection = mockEmbyService.testConnection;
        embyService.getLibraries = mockEmbyService.getLibraries;
        jellyfinService.testConnection = mockJellyfinService.testConnection;
        jellyfinService.getLibraries = mockJellyfinService.getLibraries;
        mediaSyncService.syncLibrary.mockClear();
        mediaSyncService.syncLibrary.mockResolvedValue({});

        syncStatus.reset();
    });

    describe('POST /api/media-server - Issue #74 Regression Test', () => {
        const newServerData = {
            type: 'plex',
            name: 'My Plex Server',
            url: 'http://plex:32400',
            api_key: 'test-api-key-123'
        };

        test('should UPDATE existing server instead of INSERT new (preserves ID)', async () => {
            const existingServerId = 42;

            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({ rows: [{ api_key: 'old-key' }] });
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: existingServerId }] });
            mockClient.query.mockResolvedValueOnce({
                rows: [{
                    id: existingServerId,
                    type: 'plex',
                    name: 'My Plex Server',
                    url: 'http://plex:32400',
                    api_key: 'test-api-key-123',
                    is_active: true
                }]
            });
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app)
                .post('/api/media-server')
                .send(newServerData);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(existingServerId);

            const updateCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('UPDATE media_server')
            );
            expect(updateCall).toBeDefined();

            const insertCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('INSERT INTO media_server') &&
                call[0].includes('VALUES')
            );
            expect(insertCall).toBeUndefined();
        });

        test('should INSERT new server when no active server exists', async () => {
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            mockClient.query.mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    type: 'plex',
                    name: 'My Plex Server',
                    url: 'http://plex:32400',
                    api_key: 'test-api-key-123',
                    is_active: true
                }]
            });
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app)
                .post('/api/media-server')
                .send(newServerData);

            expect(response.status).toBe(200);

            const insertCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('INSERT INTO media_server')
            );
            expect(insertCall).toBeDefined();
        });

        test('should return 400 when no API key provided and none saved', async () => {
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app)
                .post('/api/media-server')
                .send({ ...newServerData, api_key: null });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('API key is required');
        });
    });

    describe('GET /api/media-server', () => {
        test('should return active media server with masked API key', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    id: 1,
                    type: 'plex',
                    name: 'Test Server',
                    url: 'http://localhost:32400',
                    api_key: 'secret-api-key-12345',
                    is_active: true
                }]
            });

            const response = await request(app).get('/api/media-server');

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Test Server');
            expect(response.body.api_key).toMatch(/^•+/);
            expect(response.body.api_key).not.toBe('secret-api-key-12345');
        });

        test('should return null when no active server configured', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const response = await request(app).get('/api/media-server');

            expect(response.status).toBe(200);
            expect(response.body).toBeNull();
        });
    });

    describe('POST /api/media-server/sync - Library Sync', () => {
        const plexService = mockPlexService;

        test('should DELETE existing libraries before inserting new ones', async () => {
            const serverId = 1;
            const mockLibraries = [
                { external_id: 'lib-1', name: 'Movies', media_type: 'movie' },
                { external_id: 'lib-2', name: 'TV Shows', media_type: 'tv' }
            ];

            plexService.getLibraries.mockResolvedValue(mockLibraries);

            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({
                rows: [{
                    id: serverId,
                    type: 'plex',
                    url: 'http://plex:32400',
                    api_key: 'test-key'
                }]
            });
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 10, external_id: 'old-1' }, { id: 11, external_id: 'old-2' }, { id: 12, external_id: 'old-3' }]
            });
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            mockClient.query.mockResolvedValueOnce({ rowCount: 3 });
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 1, name: 'Movies', media_type: 'movie', external_id: 'lib-1' }]
            });
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 2, name: 'TV Shows', media_type: 'tv', external_id: 'lib-2' }]
            });
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({});

            mockClient.query.mockResolvedValue({ rows: [{ error_id: 1 }] });

            const response = await request(app).post('/api/media-server/sync');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.libraries).toHaveLength(2);

            const deleteCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('DELETE FROM libraries')
            );
            expect(deleteCall).toBeDefined();
            expect(deleteCall[1]).toEqual([[10, 11, 12]]);

            const insertCalls = mockClient.query.mock.calls.filter(call =>
                call[0] && call[0].includes('INSERT INTO libraries')
            );
            expect(insertCalls).toHaveLength(2);
            insertCalls.forEach(call => {
                expect(call[0]).not.toContain('ON CONFLICT');
            });
        });

        test('should handle sync after Plex database rebuild (changed external IDs)', async () => {
            const serverId = 1;
            const newLibraries = [
                { external_id: 'NEW-lib-uuid-1', name: 'Movies', media_type: 'movie' }
            ];

            plexService.getLibraries.mockResolvedValue(newLibraries);

            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({
                rows: [{
                    id: serverId,
                    type: 'plex',
                    url: 'http://plex:32400',
                    api_key: 'test-key'
                }]
            });
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 99, external_id: 'OLD-lib-uuid-1' }]
            });
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 100, name: 'Movies', media_type: 'movie', external_id: 'NEW-lib-uuid-1' }]
            });
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app).post('/api/media-server/sync');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.libraries[0].external_id).toBe('NEW-lib-uuid-1');
        });

        test('should return 404 when no active server configured', async () => {
            mockClient.query.mockResolvedValueOnce({});
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app).post('/api/media-server/sync');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('No active media server configured');
        });
    });

    describe('POST /api/media-server/ingest', () => {
        test('should trigger queue refill and return queued count', async () => {
            const refillSpy = jest.spyOn(queueService, 'refillQueue').mockResolvedValueOnce({ queued: 7 });

            const response = await request(app).post('/api/media-server/ingest');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                queued: 7,
                message: 'Ingestion triggered. Added 7 items to queue.'
            });
            expect(refillSpy).toHaveBeenCalledTimes(1);

            refillSpy.mockRestore();
        });

        test('should return 500 when queue refill fails', async () => {
            const refillSpy = jest.spyOn(queueService, 'refillQueue').mockRejectedValueOnce(new Error('queue refill failed'));

            const response = await request(app).post('/api/media-server/ingest');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ error: 'queue refill failed' });

            refillSpy.mockRestore();
        });
    });
});
