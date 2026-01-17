/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');
const { authenticate } = require('../../middleware/auth');

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { id: 1 };
    next();
  })
}));

const activityRouter = require('../../routes/activity');

describe('Activity API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/activity', activityRouter);
  });

  describe('GET /api/activity/progress', () => {
    it('should return all active classifications', async () => {
      const response = await request(app)
        .get('/api/activity/progress')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should call authenticate middleware', async () => {
      await request(app)
        .get('/api/activity/progress')
        .expect(200);

      expect(authenticate).toHaveBeenCalled();
    });

    it('should return empty array when no active classifications', async () => {
      const response = await request(app)
        .get('/api/activity/progress')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/activity/progress/:taskId', () => {
    it('should return progress for a specific task', async () => {
      const taskId = 1;
      const response = await request(app)
        .get(`/api/activity/progress/${taskId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', taskId);
    });

    it('should return 404 for non-existent task', async () => {
      const taskId = 999;
      const response = await request(app)
        .get(`/api/activity/progress/${taskId}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should call authenticate middleware', async () => {
      const taskId = 1;
      await request(app)
        .get(`/api/activity/progress/${taskId}`)
        .expect(200);

      expect(authenticate).toHaveBeenCalled();
    });

    it('should validate taskId parameter', async () => {
      const response = await request(app)
        .get('/api/activity/progress/invalid')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Progress data structure', () => {
    it('should return progress with correct structure', async () => {
      const response = await request(app)
        .get('/api/activity/progress')
        .expect(200);

      if (response.body.data.length > 0) {
        const progress = response.body.data[0];
        expect(progress).toHaveProperty('id');
        expect(progress).toHaveProperty('current_phase');
        expect(progress).toHaveProperty('progress');
        expect(progress).toHaveProperty('phase_history');
        expect(progress).toHaveProperty('media_item_id');
        expect(progress).toHaveProperty('title');

        // Validate phase is one of the allowed phases
        const allowedPhases = ['queued', 'metadata_fetch', 'policy_evaluation', 'rag_analysis', 'signal_combination', 'decision', 'notification', 'completed'];
        expect(allowedPhases).toContain(progress.current_phase);

        // Validate progress is between 0 and 100
        expect(progress.progress).toBeGreaterThanOrEqual(0);
        expect(progress.progress).toBeLessThanOrEqual(100);

        // Validate phase_history is an array
        expect(Array.isArray(progress.phase_history)).toBe(true);
      }
    });
  });

  describe('Error handling', () => {
    it('should return 500 on database error', async () => {
      // Mock database error
      const originalQuery = require('../../config/database').query;
      require('../../config/database').query = jest.fn(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/activity/progress')
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Failed to fetch classification progress');

      // Restore original query
      require('../../config/database').query = originalQuery;
    });
  });
});
