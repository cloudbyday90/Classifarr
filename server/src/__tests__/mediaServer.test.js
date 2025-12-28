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
});
