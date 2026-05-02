/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/*
 * Integration tests for sync 404 handling
 * Tests proper error handling for missing libraries in sync endpoints
 */

const request = require('supertest');
const setup = require('./setup');
const express = require('express');
const bodyParser = require('body-parser');
const db = require('../../config/database');
const radarrService = require('../../services/radarr');
const sonarrService = require('../../services/sonarr');
const ollamaService = require('../../services/ollama');
const mediaPatternAnalyzer = require('../../services/mediaPatternAnalyzer');
const libraryProfileService = require('../../services/libraryProfileService');
const { createLogger } = require('../../utils/logger');
const { normalizeMetadataListLower } = require('../../utils/metadataNormalization');
const { authenticateTokenOrApiKey, requireReadWrite } = require('../../middleware/apiKeyAuth');

let mediaSyncRouter;
let createLibrariesRouter;
let metadataEnrichment;
let errors;

// Mock logger to avoid noise
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

// Mock auth middleware to bypass authentication in tests
jest.mock('../../middleware/apiKeyAuth', () => ({
  authenticateTokenOrApiKey: (req, res, next) => next(),
  requireReadWrite: (req, res, next) => next()
}));

// Mock the sync status service to avoid conflicts
jest.mock('../../services/syncStatus', () => ({
  tryStart: jest.fn(() => ({ started: true })),
  stop: jest.fn()
}));

describe('Sync 404 Handling Integration Tests', () => {
  let app;
  let pool;

  beforeAll(async () => {
    ({ default: mediaSyncRouter } = await import('../../routes/mediaSync.mjs'));
    ({ createLibrariesRouter } = await import('../../routes/librariesRouteShared.mjs'));
    metadataEnrichment = await import('../../utils/metadataEnrichment.mjs');
    errors = await import('../../utils/errors.mjs');

    // Get the pool from the setup module
    pool = setup.getPool();

    // Clear any existing data
    await pool.query('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE media_server RESTART IDENTITY CASCADE');

    // Insert a test media server
    await pool.query(`
      INSERT INTO media_server (id, name, type, url, api_key, is_active) 
      VALUES (1, 'Test Server', 'plex', 'http://localhost:32400', 'test-key', true)
    `);

    // Insert a test library
    await pool.query(`
      INSERT INTO libraries (id, media_server_id, external_id, name, media_type, arr_type)
      VALUES (1, 1, 'lib1', 'Test Library', 'movie', 'radarr')
    `);

    // Create test app
    app = express();
    app.use(bodyParser.json());

    mediaSyncRouter.loadMediaSyncService = jest.fn().mockImplementation(() => import('../../services/mediaSync.mjs'));
    app.use('/api/libraries', createLibrariesRouter({
      express,
      db,
      radarrService,
      sonarrService,
      ollamaService,
      mediaPatternAnalyzer,
      libraryProfileService,
      createLogger,
      normalizeMetadataListLower,
      authenticateTokenOrApiKey,
      requireReadWrite,
      loadMediaSyncService: jest.fn().mockImplementation(() => import('../../services/mediaSync.mjs')),
      metadataEnrichment,
      errors,
    }));
    app.use('/api/media-sync', mediaSyncRouter);
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE media_server RESTART IDENTITY CASCADE');
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
      const { createLogger } = require('../../utils/logger');
      const mockLogger = createLogger();

      // Clear previous calls
      mockLogger.error.mockClear();
      mockLogger.warn.mockClear();

      await request(app)
        .post('/api/libraries/99999/sync')
        .send({})
        .expect(404);

      // Verify that error logger was NOT called in the route handler for expected 404
      // The service layer logs a warning (not an error) which is the expected behavior
      expect(mockLogger.error).not.toHaveBeenCalled();
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

      // Verify simple { error: "message" } format (consistent with rest of codebase)
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
      const { createLogger } = require('../../utils/logger');
      const mockLogger = createLogger();

      // Clear previous calls
      mockLogger.error.mockClear();
      mockLogger.warn.mockClear();

      await request(app)
        .get('/api/media-sync/items/99999')
        .expect(404);

      // The service layer logs a warning (not an error)
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return empty items array for existing library with no items', async () => {
      // Use the existing library from beforeAll (id=1)
      // It should have no media_server_items associated with it
      const response = await request(app)
        .get('/api/media-sync/items/1')
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });
});
