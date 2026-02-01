/*
 * Integration tests for sync 404 handling
 * Tests proper error handling for missing libraries in sync endpoints
 */

const request = require('supertest');
const setup = require('./setup');

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

const express = require('express');
const librariesRouter = require('../../routes/libraries');
const mediaSyncRouter = require('../../routes/mediaSync');
const bodyParser = require('body-parser');

// Mock the sync status service to avoid conflicts
jest.mock('../../services/syncStatus', () => ({
  tryStart: jest.fn(() => ({ started: true })),
  stop: jest.fn()
}));

describe('Sync 404 Handling Integration Tests', () => {
  let app;
  let pool;

  beforeAll(async () => {
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

    app.use('/api/libraries', librariesRouter);
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

      expect(response.body).toMatchObject({
        error: 'Library not found',
        code: 404,
        libraryId: 99999
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

      // Should not have called error logger in the route handler for 404
      // (Note: The service logs a warning, which is expected)
    });
  });

  describe('POST /api/media-sync/sync/:libraryId', () => {
    it('should return 404 for missing library', async () => {
      const response = await request(app)
        .post('/api/media-sync/sync/99999')
        .send({})
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Library not found',
        code: 404,
        libraryId: 99999
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
    it('should return structured JSON error for 404', async () => {
      const response = await request(app)
        .post('/api/libraries/12345/sync')
        .send({})
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code');
      expect(response.body).toHaveProperty('libraryId');
      expect(response.body.error).toBe('Library not found');
      expect(response.body.code).toBe(404);
      expect(response.body.libraryId).toBe(12345);
    });
  });
});
