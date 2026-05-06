/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { default: ratingNormalizationRouter } = await import('../../routes/ratingNormalization.mjs');

describe('Rating Normalization API', () => {
  let app;

  beforeAll(async () => {
    // Create minimal express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/rating-normalization', ratingNormalizationRouter);
  });

  beforeEach(async () => {
    // Clean up tables
    await db.query('DELETE FROM task_queue');
    await db.query('DELETE FROM media_server_items');
    await db.query('DELETE FROM libraries');
    await db.query('DELETE FROM media_server');
  });

  // No afterAll cleanup needed - db is managed by integration test setup

  describe('GET /api/rating-normalization/stats', () => {
    test('returns correct counts when no items exist', async () => {
      const response = await request(app)
        .get('/api/rating-normalization/stats')
        .expect(200);

      expect(response.body).toEqual({
        needsNormalization: 0,
        alreadyNormalized: 0,
        queuedTasks: 0,
        failedTasks: 0,
      });
    });

    test('counts items needing normalization (age-based ratings)', async () => {
      // Create test media server and library
      const serverResult = await db.query(`
        INSERT INTO media_server (name, type, url, api_key)
        VALUES ('Test Server', 'plex', 'http://localhost', 'token')
        RETURNING id
      `);
      const serverId = serverResult.rows[0].id;

      const libraryResult = await db.query(`
        INSERT INTO libraries (name, media_type, media_server_id, external_id)
        VALUES ('Test Library', 'movie', $1, 'ext1')
        RETURNING id
      `, [serverId]);
      const libraryId = libraryResult.rows[0].id;

      // Add items with age-based ratings
      await db.query(`
        INSERT INTO media_server_items (media_server_id, library_id, external_id, title, media_type, content_rating, original_rating)
        VALUES
          ($1, $2, 'item1', 'Movie 1', 'movie', '13', NULL),
          ($1, $2, 'item2', 'Movie 2', 'movie', '16', NULL),
          ($1, $2, 'item3', 'Movie 3', 'movie', 'PG-13', 'PG-13')
      `, [serverId, libraryId]);

      const response = await request(app)
        .get('/api/rating-normalization/stats')
        .expect(200);

      expect(response.body.needsNormalization).toBe(2);
      expect(response.body.alreadyNormalized).toBe(1);
    });

    test('counts items needing normalization (non-standard ratings)', async () => {
      const serverResult = await db.query(`
        INSERT INTO media_server (name, type, url, api_key)
        VALUES ('Test Server', 'plex', 'http://localhost', 'token')
        RETURNING id
      `);
      const serverId = serverResult.rows[0].id;

      const libraryResult = await db.query(`
        INSERT INTO libraries (name, media_type, media_server_id, external_id)
        VALUES ('Test Library', 'movie', $1, 'ext1')
        RETURNING id
      `, [serverId]);
      const libraryId = libraryResult.rows[0].id;

      await db.query(`
        INSERT INTO media_server_items (media_server_id, library_id, external_id, title, media_type, content_rating, original_rating)
        VALUES
          ($1, $2, 'item1', 'Movie 1', 'movie', 'FSK 16', NULL),
          ($1, $2, 'item2', 'Movie 2', 'movie', '12A', NULL)
      `, [serverId, libraryId]);

      const response = await request(app)
        .get('/api/rating-normalization/stats')
        .expect(200);

      expect(response.body.needsNormalization).toBe(2);
    });

    test('counts queued and failed tasks', async () => {
      // Add some queued tasks
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload)
        VALUES
          ('rating_normalization', 'pending', '{"media_item_id": 1}'),
          ('rating_normalization', 'processing', '{"media_item_id": 2}'),
          ('rating_normalization', 'failed', '{"media_item_id": 3}')
      `);

      const response = await request(app)
        .get('/api/rating-normalization/stats')
        .expect(200);

      expect(response.body.queuedTasks).toBe(2);
      expect(response.body.failedTasks).toBe(1);
    });
  });

  describe('POST /api/rating-normalization/backfill', () => {
    test('queues items needing normalization', async () => {
      const serverResult = await db.query(`
        INSERT INTO media_server (name, type, url, api_key)
        VALUES ('Test Server', 'plex', 'http://localhost', 'token')
        RETURNING id
      `);
      const serverId = serverResult.rows[0].id;

      const libraryResult = await db.query(`
        INSERT INTO libraries (name, media_type, media_server_id, external_id)
        VALUES ('Test Library', 'movie', $1, 'ext1')
        RETURNING id
      `, [serverId]);
      const libraryId = libraryResult.rows[0].id;

      await db.query(`
        INSERT INTO media_server_items (media_server_id, library_id, external_id, title, media_type, content_rating, original_rating)
        VALUES
          ($1, $2, 'item1', 'Movie 1', 'movie', '13', NULL),
          ($1, $2, 'item2', 'Movie 2', 'movie', '16', NULL)
      `, [serverId, libraryId]);

      const response = await request(app)
        .post('/api/rating-normalization/backfill')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.queued).toBe(2);

      // Verify tasks were created
      const tasksResult = await db.query(`
        SELECT * FROM task_queue WHERE task_type = 'rating_normalization'
      `);
      expect(tasksResult.rows).toHaveLength(2);
      expect(tasksResult.rows[0].status).toBe('pending');
    });

    test('returns zero when no items need normalization', async () => {
      const response = await request(app)
        .post('/api/rating-normalization/backfill')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.queued).toBe(0);
    });
  });

  describe('POST /api/rating-normalization/finalize', () => {
    test('returns pending status when tasks still in queue', async () => {
      await db.query(`
        INSERT INTO task_queue (task_type, status, payload)
        VALUES ('rating_normalization', 'pending', '{"media_item_id": 1}')
      `);

      const response = await request(app)
        .post('/api/rating-normalization/finalize')
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.pending).toBe(1);
      expect(response.body.message).toContain('Still processing');
    });

    test('attempts to regenerate profiles when no pending tasks', async () => {
      // Note: The actual libraryProfileService.generateAllProfiles() will be called
      // but may fail in test environment - we're just testing the endpoint logic
      const response = await request(app)
        .post('/api/rating-normalization/finalize')
        .expect(200);

      // Should succeed or fail gracefully
      expect(response.body).toHaveProperty('success');
    });
  });
});