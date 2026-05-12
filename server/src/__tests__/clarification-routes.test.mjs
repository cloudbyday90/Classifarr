/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import request from 'supertest';
import { jest } from '@jest/globals';
import { createLoggerModuleMock, createMountedTestApp } from './helpers/setupRouteTest.mjs';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const db = {
  query: jest.fn(),
};

const clarificationService = {
  createQuestion: jest.fn(),
  deleteQuestion: jest.fn(),
  getAllQuestions: jest.fn(),
  getThresholds: jest.fn(),
  matchQuestions: jest.fn(),
  recordResponse: jest.fn(),
  updateQuestion: jest.fn(),
  updateThreshold: jest.fn(),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

jest.unstable_mockModule('../services/clarificationService.mjs', () => ({ clarificationService }));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { router: clarificationRouter } = await import('../routes/clarification.mjs');

describe('clarification routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createMountedTestApp({
      basePath: '/api/clarifications',
      router: clarificationRouter,
    });
  });

  test('GET /api/clarifications/settings/confidence hits settings route before classification route', async () => {
    clarificationService.getThresholds.mockResolvedValueOnce({ auto: 90, verify: 70 });

    const response = await request(app)
      .get('/api/clarifications/settings/confidence')
      .expect(200);

    expect(response.body).toEqual({ auto: 90, verify: 70 });
    expect(clarificationService.getThresholds).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('GET /api/clarifications/:classificationId returns stored policy question when present', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ metadata: { genres: ['Comedy'] }, policy_question: '{"question":"Pick one"}' }],
    });

    const response = await request(app)
      .get('/api/clarifications/42')
      .expect(200);

    expect(response.body).toEqual([{ question: 'Pick one' }]);
    expect(clarificationService.matchQuestions).not.toHaveBeenCalled();
  });

  test('GET /api/clarifications/:classificationId falls back to matched questions', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ metadata: { genres: ['Documentary'] }, policy_question: null }],
    });
    clarificationService.matchQuestions.mockResolvedValueOnce([{ id: 1, question_text: 'Question' }]);

    const response = await request(app)
      .get('/api/clarifications/42?maxQuestions=5')
      .expect(200);

    expect(response.body).toEqual([{ id: 1, question_text: 'Question' }]);
    expect(clarificationService.matchQuestions).toHaveBeenCalledWith({ genres: ['Documentary'] }, 5);
  });

  test('POST /api/clarifications/:id/respond validates required fields', async () => {
    const response = await request(app)
      .post('/api/clarifications/1/respond')
      .send({ classificationId: 1, responseValue: 'yes' })
      .expect(400);

    expect(response.body.error).toMatch(/missing required fields/i);
    expect(clarificationService.recordResponse).not.toHaveBeenCalled();
  });

  test('POST /api/clarifications/:id/respond records the response', async () => {
    clarificationService.recordResponse.mockResolvedValueOnce({ success: true });

    const response = await request(app)
      .post('/api/clarifications/1/respond')
      .send({
        classificationId: 5,
        questionId: 9,
        responseValue: 'yes',
        discordUserId: 'user-1',
        confidenceBefore: 82,
      })
      .expect(200);

    expect(response.body).toEqual({ success: true });
    expect(clarificationService.recordResponse).toHaveBeenCalledWith(5, 9, 'yes', 'user-1', 82);
  });
});
