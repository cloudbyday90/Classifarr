/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Media Server API Tests - Issue #74 Regression Prevention
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createNamedMockModule } from './helpers/mockFactory.mjs';
import { errorHandler } from '../middleware/errorHandler.mjs';

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
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, DB_ADVISORY_LOCKS: { STARTUP_RESET: 9001 } }));

const mockSyncLibrary = jest.fn().mockResolvedValue({});
const mockMediaSync = { syncLibrary: mockSyncLibrary };
jest.unstable_mockModule('../services/mediaSync.mjs', () => createNamedMockModule('mediaSyncService', mockMediaSync));

const mockQueueService = {
    refillQueue: jest.fn(),
};

const mockMaskToken = jest.fn((value) => (value ? '••••masked' : value));
const mockIsMaskedToken = jest.fn((value) => typeof value === 'string' && value.startsWith('•'));
const mockLogger = {
    error: jest.fn(),
    info: jest.fn(),
};

const db = mockDb;
const { mediaSyncService } = await import('../services/mediaSync.mjs');
const { createMediaServerRouter } = await import('../routes/mediaServer.mjs');

const mockPlexService = {
    testConnection: jest.fn(),
    getLibraryCatalog: jest.fn()
};

const mockEmbyService = {
    testConnection: jest.fn(),
    getLibraryCatalog: jest.fn()
};

const mockJellyfinService = {
    testConnection: jest.fn(),
    getLibraryCatalog: jest.fn()
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
        jest.clearAllMocks();

        app = express();
        app.use(express.json());
        app.use('/api/media-server', createMediaServerRouter({
            express,
            db,
            mediaSyncService,
            queueService: mockQueueService,
            getMediaServerServiceByType: mockGetMediaServerService,
            maskTokenValue: mockMaskToken,
            isMaskedTokenValue: mockIsMaskedToken,
            logger: mockLogger,
        }));
        app.use(errorHandler);

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.pool.connect.mockResolvedValue(mockClient);

        mockGetMediaServerService.mockClear();
        mockPlexService.testConnection.mockReset();
        mockPlexService.getLibraryCatalog.mockReset();
        mockEmbyService.testConnection.mockReset();
        mockEmbyService.getLibraryCatalog.mockReset();
        mockJellyfinService.testConnection.mockReset();
        mockJellyfinService.getLibraryCatalog.mockReset();
        mockQueueService.refillQueue.mockReset();
        mockMaskToken.mockClear();
        mockIsMaskedToken.mockClear();
        mockLogger.error.mockClear();
        mockLogger.info.mockClear();
        mediaSyncService.syncLibrary.mockClear();
        mediaSyncService.syncLibrary.mockResolvedValue({});
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
        const source = { id: 1, type: 'plex', url: 'http://plex:32400', api_key: 'test-key', is_active: true };
        beforeEach(() => {
            db.query.mockReset().mockResolvedValue({ rows: [source] });
            mockClient.query.mockReset().mockImplementation(async (sql, params) => {
                if (sql.startsWith('SELECT pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
                if (sql.startsWith('SELECT * FROM media_server')) return { rows: [source] };
                if (sql.includes('FROM libraries')) return { rows: [{ id: 99, external_id: 'old-key', name: 'Movies' }] };
                if (sql.includes('INSERT INTO libraries(')) return { rows: [{ id: 100, external_id: params[1], name: params[2], is_active: true }] };
                return { rows: [], rowCount: 1 };
            });
        });
        test('preserves old identities after a source rebuild instead of deleting by absence', async () => {
            mockPlexService.getLibraryCatalog.mockResolvedValue([{ external_id: 'new-key', name: 'Movies', media_type: 'movie' }]);
            const response = await request(app).post('/api/media-server/sync');
            expect(response.status).toBe(200);
            expect(response.body.libraries[0].external_id).toBe('new-key');
            expect(response.body.preservedLibraries).toEqual([{ id: 99, name: 'Movies' }]);
            expect(mockClient.query.mock.calls.some(([sql]) => /DELETE|classification_history/.test(sql))).toBe(false);
        });
        test('valid empty catalogs preserve existing libraries without starting content sync', async () => {
            mockPlexService.getLibraryCatalog.mockResolvedValue([]);
            const response = await request(app).post('/api/media-server/sync');
            expect(response.status).toBe(200);
            expect(response.body.libraries).toEqual([]);
            expect(response.body.preservedLibraries).toHaveLength(1);
            expect(mockSyncLibrary).not.toHaveBeenCalled();
        });
        test('no configured source returns 404 without opening a write transaction', async () => {
            mockClient.query.mockImplementation(async sql => ({ rows: sql.startsWith('SELECT pg_try_advisory_lock') ? [{ acquired: true }] : [] }));
            expect((await request(app).post('/api/media-server/sync')).status).toBe(404);
            expect(mockClient.query.mock.calls.some(([sql]) => /^(BEGIN|INSERT|UPDATE|DELETE)/.test(sql))).toBe(false);
            expect(mockPlexService.getLibraryCatalog).not.toHaveBeenCalled();
        });
        test('another catalog owner returns 409 without provider work or status writes', async () => {
            mockClient.query.mockResolvedValue({ rows: [{ acquired: false }] });
            expect((await request(app).post('/api/media-server/sync')).status).toBe(409);
            expect(mockPlexService.getLibraryCatalog).not.toHaveBeenCalled();
            expect(mockClient.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('POST /api/media-server/ingest', () => {
        test('should trigger queue refill and return queued count', async () => {
            mockQueueService.refillQueue.mockResolvedValueOnce({ queued: 7 });

            const response = await request(app).post('/api/media-server/ingest');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                success: true,
                queued: 7,
                message: 'Ingestion triggered. Added 7 items to queue.'
            });
            expect(mockQueueService.refillQueue).toHaveBeenCalledTimes(1);
        });

        test('should return 500 when queue refill fails', async () => {
            mockQueueService.refillQueue.mockRejectedValueOnce(new Error('queue refill failed'));

            const response = await request(app).post('/api/media-server/ingest');

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Internal Server Error');
            expect(response.body.message).toBe('queue refill failed');
        });
    });
});
