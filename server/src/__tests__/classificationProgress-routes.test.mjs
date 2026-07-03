/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

import { createLoggerModuleMock, createNamedMockModule, createServiceStubs } from './helpers/mockFactory.mjs';
const classificationProgressStageService = createServiceStubs(['getActiveClassifications', 'getProgress']);
const { getActiveClassifications, getProgress } = classificationProgressStageService;

jest.unstable_mockModule('../services/classificationProgressStageService.mjs', () => createNamedMockModule('classificationProgressStageService', classificationProgressStageService));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { router: classificationProgressRouter } = await import('../routes/classificationProgress.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

describe('Classification Progress Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/classification/progress', classificationProgressRouter);
    app.use(errorHandler);
  });

  describe('GET /classification/progress', () => {
    it('should return active classifications', async () => {
      getActiveClassifications.mockResolvedValueOnce([
        { taskId: 1, title: 'Movie 1', currentPhase: 'analyzing', progress: 50 },
        { taskId: 2, title: 'Movie 2', currentPhase: 'classifying', progress: 80 },
      ]);

      const res = await request(app).get('/classification/progress');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].taskId).toBe(1);
    });

    it('should return empty array when no active classifications', async () => {
      getActiveClassifications.mockResolvedValueOnce([]);

      const res = await request(app).get('/classification/progress');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should delegate 500 errors to error handler', async () => {
      getActiveClassifications.mockRejectedValueOnce(new Error('Service error'));

      const res = await request(app).get('/classification/progress');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
      expect(res.body.message).toBe('Service error');
    });
  });

  describe('GET /classification/progress/:taskId', () => {
    it('should return progress for specific task', async () => {
      getProgress.mockResolvedValueOnce({
        taskId: 123,
        title: 'Test Movie',
        currentPhase: 'analyzing',
        progress: 75,
        phases: [
          { name: 'metadata', status: 'complete', progress: 100 },
          { name: 'analyzing', status: 'in_progress', progress: 75 },
        ],
      });

      const res = await request(app).get('/classification/progress/123');

      expect(res.status).toBe(200);
      expect(res.body.taskId).toBe(123);
      expect(res.body.progress).toBe(75);
    });

    it('should return 404 when task not found', async () => {
      getProgress.mockResolvedValueOnce(null);

      const res = await request(app).get('/classification/progress/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found or not processing');
    });

    it('should delegate 500 errors to error handler', async () => {
      getProgress.mockRejectedValueOnce(new Error('Service error'));

      const res = await request(app).get('/classification/progress/123');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
      expect(res.body.message).toBe('Service error');
    });
  });
});
