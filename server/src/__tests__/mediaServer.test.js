/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Media Server API Tests - Issue #74 Regression Prevention
 */

const request = require('supertest');
const express = require('express');

// Mock the database module
jest.mock('../config/database', () => ({
    pool: {
        connect: jest.fn()
    },
    query: jest.fn()
}));

// Mock services
jest.mock('../services/plex', () => ({
    testConnection: jest.fn(),
    getLibraries: jest.fn()
}));

jest.mock('../services/emby', () => ({
    testConnection: jest.fn(),
    getLibraries: jest.fn()
}));

jest.mock('../services/jellyfin', () => ({
    testConnection: jest.fn(),
    getLibraries: jest.fn()
}));

const db = require('../config/database');
const mediaServerRouter = require('../routes/mediaServer');
const syncStatus = require('../services/syncStatus');

describe('Media Server API', () => {
    let app;
    let mockClient;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/media-server', mediaServerRouter);

        // Create mock client for transactions
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.pool.connect.mockResolvedValue(mockClient);

        jest.clearAllMocks();
        
        // Reset syncStatus singleton to prevent cross-test contamination
        // This prevents timeouts when running tests in parallel with sync-lock.test.js
        syncStatus.isRunning = false;
        syncStatus.type = null;
        syncStatus.progress = 0;
        syncStatus.currentLibrary = null;
        syncStatus.startedAt = null;
        syncStatus.canInterrupt = true;
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

            // Mock: BEGIN transaction
            mockClient.query.mockResolvedValueOnce({});
            // Mock: existing API key lookup
            mockClient.query.mockResolvedValueOnce({ rows: [{ api_key: 'old-key' }] });
            // Mock: check for existing active server - FOUND
            mockClient.query.mockResolvedValueOnce({ rows: [{ id: existingServerId }] });
            // Mock: UPDATE query result
            mockClient.query.mockResolvedValueOnce({
                rows: [{
                    id: existingServerId, // Same ID preserved!
                    type: 'plex',
                    name: 'My Plex Server',
                    url: 'http://plex:32400',
                    api_key: 'test-api-key-123',
                    is_active: true
                }]
            });
            // Mock: COMMIT
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app)
                .post('/api/media-server')
                .send(newServerData);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(existingServerId); // ID preserved!

            // Verify UPDATE was called, not INSERT
            const updateCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('UPDATE media_server')
            );
            expect(updateCall).toBeDefined();

            // Verify INSERT was NOT called
            const insertCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('INSERT INTO media_server') &&
                call[0].includes('VALUES')
            );
            expect(insertCall).toBeUndefined();
        });

        test('should INSERT new server when no active server exists', async () => {
            // Mock: BEGIN transaction
            mockClient.query.mockResolvedValueOnce({});
            // Mock: existing API key lookup (none)
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            // Mock: check for existing active server - NOT FOUND
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            // Mock: INSERT query result
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
            // Mock: COMMIT
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app)
                .post('/api/media-server')
                .send(newServerData);

            expect(response.status).toBe(200);

            // Verify INSERT was called
            const insertCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('INSERT INTO media_server')
            );
            expect(insertCall).toBeDefined();
        });

        test('should return 400 when no API key provided and none saved', async () => {
            // Mock: BEGIN transaction
            mockClient.query.mockResolvedValueOnce({});
            // Mock: existing API key lookup (none)
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            // Mock: ROLLBACK
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
            // API key should be masked
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
        const plexService = require('../services/plex');

        test('should DELETE existing libraries before inserting new ones', async () => {
            const serverId = 1;
            const mockLibraries = [
                { external_id: 'lib-1', name: 'Movies', media_type: 'movie' },
                { external_id: 'lib-2', name: 'TV Shows', media_type: 'tv' }
            ];

            // Mock Plex to return libraries
            plexService.getLibraries.mockResolvedValue(mockLibraries);

            // Mock: BEGIN
            mockClient.query.mockResolvedValueOnce({});
            // Mock: Get active server
            mockClient.query.mockResolvedValueOnce({
                rows: [{
                    id: serverId,
                    type: 'plex',
                    url: 'http://plex:32400',
                    api_key: 'test-key'
                }]
            });
            // Mock: SELECT library IDs to delete
            mockClient.query.mockResolvedValueOnce({ 
                rows: [{ id: 10 }, { id: 11 }, { id: 12 }] 
            });
            // Mock: DELETE FROM media_server_sync_status
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM enrichment_retry_queue
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM media_server_items
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM media_server_collections
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM library_labels
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM library_pattern_suggestions
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM classification_history
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM scheduled_tasks
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM task_queue
            mockClient.query.mockResolvedValueOnce({ rowCount: 5 });
            // Mock: DELETE FROM libraries
            mockClient.query.mockResolvedValueOnce({ rowCount: 3 });
            // Mock: INSERT library 1
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 1, name: 'Movies', media_type: 'movie', external_id: 'lib-1' }]
            });
            // Mock: INSERT library_policies for library 1
            mockClient.query.mockResolvedValueOnce({});
            // Mock: INSERT library 2
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 2, name: 'TV Shows', media_type: 'tv', external_id: 'lib-2' }]
            });
            // Mock: INSERT library_policies for library 2
            mockClient.query.mockResolvedValueOnce({});
            // Mock: UPDATE last_sync
            mockClient.query.mockResolvedValueOnce({});
            // Mock: COMMIT
            mockClient.query.mockResolvedValueOnce({});
            
            // Mock error_log INSERTs from background sync failures (auto-sync tries to sync non-existent libraries)
            // The syncLibrary calls will fail and log errors, which try to INSERT into error_log
            mockClient.query.mockResolvedValue({ rows: [{ error_id: 1 }] });

            const response = await request(app).post('/api/media-server/sync');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.libraries).toHaveLength(2);

            // Verify DELETE was called
            const deleteCall = mockClient.query.mock.calls.find(call =>
                call[0] && call[0].includes('DELETE FROM libraries')
            );
            expect(deleteCall).toBeDefined();
            expect(deleteCall[1]).toEqual([serverId]);

            // Verify INSERT was used (not ON CONFLICT upsert)
            const insertCalls = mockClient.query.mock.calls.filter(call =>
                call[0] && call[0].includes('INSERT INTO libraries')
            );
            expect(insertCalls).toHaveLength(2);
            // Should NOT have ON CONFLICT clause
            insertCalls.forEach(call => {
                expect(call[0]).not.toContain('ON CONFLICT');
            });
        });

        test('should handle sync after Plex database rebuild (changed external IDs)', async () => {
            const serverId = 1;
            // Simulating Plex rebuild: same library names but different external IDs
            const newLibraries = [
                { external_id: 'NEW-lib-uuid-1', name: 'Movies', media_type: 'movie' }
            ];

            plexService.getLibraries.mockResolvedValue(newLibraries);

            // Mock: BEGIN
            mockClient.query.mockResolvedValueOnce({});
            // Mock: Get active server
            mockClient.query.mockResolvedValueOnce({
                rows: [{
                    id: serverId,
                    type: 'plex',
                    url: 'http://plex:32400',
                    api_key: 'test-key'
                }]
            });
            // Mock: SELECT library IDs to delete (1 old library with OLD-lib-uuid-1)
            mockClient.query.mockResolvedValueOnce({ 
                rows: [{ id: 99 }] 
            });
            // Mock: DELETE FROM media_server_sync_status
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM enrichment_retry_queue
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM media_server_items
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM media_server_collections
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM library_labels
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM library_pattern_suggestions
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM classification_history
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM scheduled_tasks
            mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
            // Mock: DELETE FROM task_queue
            mockClient.query.mockResolvedValueOnce({ rowCount: 2 });
            // Mock: DELETE FROM libraries
            mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
            // Mock: INSERT with new external_id (this would have failed before the fix!)
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 100, name: 'Movies', media_type: 'movie', external_id: 'NEW-lib-uuid-1' }]
            });
            // Mock: UPDATE last_sync
            mockClient.query.mockResolvedValueOnce({});
            // Mock: COMMIT
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app).post('/api/media-server/sync');

            // This should succeed now (before fix it would fail with unique constraint violation)
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.libraries[0].external_id).toBe('NEW-lib-uuid-1');
        });

        test('should return 404 when no active server configured', async () => {
            // Mock: BEGIN
            mockClient.query.mockResolvedValueOnce({});
            // Mock: No active server
            mockClient.query.mockResolvedValueOnce({ rows: [] });
            // Mock: ROLLBACK
            mockClient.query.mockResolvedValueOnce({});

            const response = await request(app).post('/api/media-server/sync');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('No active media server configured');
        });
    });
});
