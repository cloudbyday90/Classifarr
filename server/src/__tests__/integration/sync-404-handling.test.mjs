/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Integration tests for sync 404 handling
 * Tests proper error handling for missing libraries in sync endpoints
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createLibrariesRouteTestDeps } from '../setup/createLibrariesRouteTestDeps.mjs';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { createLibrariesRouter } from '../../routes/librariesRouteShared.mjs';
import { createMediaSyncRouter } from '../../routes/mediaSyncRouteShared.mjs';
import { errorHandler } from '../../middleware/errorHandler.mjs';

const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};

const createLogger = jest.fn(() => logger);
const authenticateTokenOrApiKey = (req, res, next) => next();
const requireReadWrite = (req, res, next) => next();
const syncStatus = {
    tryStart: jest.fn(() => ({ started: true })),
    stop: jest.fn(),
};

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../utils/logger.mjs', () => ({
    default: { createLogger },
    createLogger,
}));

const { default: db } = await import('../../config/database.mjs');
const { mediaSyncService } = await import('../../services/mediaSync.mjs');
const app = express();
app.use(express.json());
app.use('/api/libraries', createLibrariesRouter(createLibrariesRouteTestDeps({
    express,
    db,
    createLogger,
    authenticateTokenOrApiKey,
    requireReadWrite,
    mediaSyncService,
})));
app.use('/api/media-sync', createMediaSyncRouter({
    express,
    createLogger,
    syncStatus,
    authenticateTokenOrApiKey,
    requireReadWrite,
    mediaSyncService,
}));
app.use(errorHandler);

describe('Sync 404 Handling Integration Tests', () => {
    let pool;

    beforeAll(async () => {
        pool = getPool();

        await pool.query('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE media_server RESTART IDENTITY CASCADE');

        await pool.query(`
            INSERT INTO media_server (id, name, type, url, api_key, is_active)
            VALUES (1, 'Test Server', 'plex', 'http://localhost:32400', 'test-key', true)
        `);

        await pool.query(`
            INSERT INTO libraries (id, media_server_id, external_id, name, media_type, arr_type)
            VALUES (1, 1, 'lib1', 'Test Library', 'movie', 'radarr')
        `);
    });

    afterAll(async () => {
        await pool.query('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE');
        await pool.query('TRUNCATE TABLE media_server RESTART IDENTITY CASCADE');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        syncStatus.tryStart.mockReturnValue({ started: true });
    });

    describe('POST /api/libraries/:id/sync', () => {
        it('should return 404 for missing library', async () => {
            const response = await request(app)
                .post('/api/libraries/99999/sync')
                .send({})
                .expect(404);

            expect(response.body).toEqual({
                error: 'Library not found'
            });
        });

        it('should not log errors for expected 404s', async () => {
            await request(app)
                .post('/api/libraries/99999/sync')
                .send({})
                .expect(404);

            expect(logger.error).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/media-sync/sync/:libraryId', () => {
        it('should return 404 for missing library', async () => {
            const response = await request(app)
                .post('/api/media-sync/sync/99999')
                .send({})
                .expect(404);

            expect(response.body).toEqual({
                error: 'Library not found'
            });
        });

        it('should have consistent 404 format across both endpoints', async () => {
            const response1 = await request(app)
                .post('/api/libraries/99999/sync')
                .send({});

            const response2 = await request(app)
                .post('/api/media-sync/sync/99999')
                .send({});

            expect(response1.body).toEqual(response2.body);
            expect(response1.status).toBe(404);
            expect(response2.status).toBe(404);
        });
    });

    describe('Error response structure', () => {
        it('should return simple error format matching codebase conventions', async () => {
            const response = await request(app)
                .post('/api/libraries/12345/sync')
                .send({})
                .expect(404);

            expect(response.body).toEqual({
                error: 'Library not found'
            });
        });
    });

    describe('GET /api/media-sync/items/:libraryId', () => {
        it('should return 404 for missing library', async () => {
            const response = await request(app)
                .get('/api/media-sync/items/99999')
                .expect(404);

            expect(response.body).toEqual({
                error: 'Library not found'
            });
        });

        it('should not log errors for expected 404s on GET', async () => {
            await request(app)
                .get('/api/media-sync/items/99999')
                .expect(404);

            expect(logger.error).not.toHaveBeenCalled();
        });

        it('should return empty items array for existing library with no items', async () => {
            const response = await request(app)
                .get('/api/media-sync/items/1')
                .expect(200);

            expect(response.body.items).toEqual([]);
            expect(response.body.total).toBe(0);
        });
    });
});
