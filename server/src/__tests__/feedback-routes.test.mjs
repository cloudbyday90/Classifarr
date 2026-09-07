/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import request from 'supertest';
import { jest } from '@jest/globals';
import { createLoggerModuleMock, createMountedTestApp, createStandardDbMock } from './helpers/setupRouteTest.mjs';
import { createNamedServiceStub } from './helpers/mockFactory.mjs';
import { ValidationError } from '../utils/appError.mjs';

const {
  service: feedbackAnalysis,
  module: feedbackAnalysisModule,
} = createNamedServiceStub('feedbackAnalysis', [
  'recordFeedback',
  'getPendingSuggestions',
  'analyzePolicy',
  'applySuggestion',
  'rejectSuggestion',
  'runFullAnalysis',
]);
const {
  getPendingSuggestions,
  analyzePolicy,
  applySuggestion,
  rejectSuggestion,
  runFullAnalysis,
} = feedbackAnalysis;
const query = jest.fn();
const recordStandaloneFeedback = jest.fn();
jest.unstable_mockModule('../services/standaloneFeedbackService.mjs', () => ({ recordStandaloneFeedback }));

jest.unstable_mockModule('../services/feedbackAnalysis.mjs', () => feedbackAnalysisModule);

jest.unstable_mockModule('../config/database.mjs', () => createStandardDbMock(query));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { router: feedbackRouter } = await import('../routes/feedback.mjs');

describe('Feedback Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createMountedTestApp({
      basePath: '/feedback',
      router: feedbackRouter,
      middleware: [
        (req, _res, next) => {
          req.user = { id: 55 };
          next();
        },
      ],
    });
  });

  it('delegates source-bound intake and returns a created receipt', async () => {
    recordStandaloneFeedback.mockResolvedValueOnce({ feedbackId: 901, replayed: false });

    const res = await request(app)
      .post('/feedback')
      .send({ classification_id: 10, selected_library_id: 2, selected_policy_id: 3 })
      .expect(201);

    expect(recordStandaloneFeedback).toHaveBeenCalledWith({ db: expect.any(Object), feedbackAnalysis,
      body: { classification_id: 10, selected_library_id: 2, selected_policy_id: 3 } });
    expect(res.body).toEqual({
      success: true,
      feedbackId: 901,
      replayed: false,
      message: 'Feedback recorded successfully',
    });
  });

  it('rejects feedback payloads missing required fields', async () => {
    recordStandaloneFeedback.mockRejectedValueOnce(new ValidationError('classification_id is required'));
    const res = await request(app)
      .post('/feedback')
      .send({ tmdb_id: 10 })
      .expect(400);

    expect(res.body.error).toBe('classification_id is required');
  });

  it('returns a successful replay without a created status', async () => {
    recordStandaloneFeedback.mockResolvedValueOnce({ feedbackId: 901, replayed: true });
    const response = await request(app).post('/feedback').send({ classification_id: 10 }).expect(200);
    expect(response.body).toMatchObject({ feedbackId: 901, replayed: true });
  });

  it('returns pending suggestions for a valid policy id', async () => {
    getPendingSuggestions.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const res = await request(app).get('/feedback/policies/11/suggestions').expect(200);

    expect(getPendingSuggestions).toHaveBeenCalledWith(11);
    expect(res.body).toEqual({
      policyId: 11,
      count: 2,
      suggestions: [{ id: 1 }, { id: 2 }],
    });
  });

  it('rejects invalid policy ids for analysis', async () => {
    const res = await request(app)
      .post('/feedback/policies/not-a-number/analyze')
      .send({})
      .expect(400);

    expect(res.body).toEqual({ error: 'Invalid policy ID' });
  });

  it('applies default analyze options when values are missing', async () => {
    analyzePolicy.mockResolvedValueOnce({ created: 4 });

    const res = await request(app)
      .post('/feedback/policies/7/analyze')
      .send({})
      .expect(200);

    expect(analyzePolicy).toHaveBeenCalledWith(7, { days: 30, minFeedback: 5 });
    expect(res.body).toEqual({ success: true, created: 4 });
  });

  it('returns empty stats when no policy stats exist yet', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/feedback/policies/7/stats').expect(200);

    expect(res.body).toEqual({
      policyId: 7,
      message: 'No learning statistics available yet',
      stats: null,
    });
  });

  it('returns policy stats when they exist', async () => {
    query.mockResolvedValueOnce({ rows: [{ accuracy_rate: 95, policy_name: 'Test Policy' }] });

    const res = await request(app).get('/feedback/policies/7/stats').expect(200);

    expect(query).toHaveBeenCalledWith(expect.any(String), [7]);
    expect(res.body).toEqual({
      policyId: 7,
      stats: { accuracy_rate: 95, policy_name: 'Test Policy' },
    });
  });

  it('rejects invalid suggestion ids for apply', async () => {
    const res = await request(app).post('/feedback/suggestions/nope/apply').send({}).expect(400);

    expect(res.body).toEqual({ error: 'Invalid suggestion ID' });
  });

  it('applies suggestions with the authenticated user id', async () => {
    applySuggestion.mockResolvedValueOnce({ updated: true });

    const res = await request(app).post('/feedback/suggestions/9/apply').send({}).expect(200);

    expect(applySuggestion).toHaveBeenCalledWith(9, 55);
    expect(res.body).toEqual({
      success: true,
      updated: true,
      message: 'Suggestion applied successfully',
    });
  });

  it('rejects suggestions with a default reason when one is not provided', async () => {
    rejectSuggestion.mockResolvedValueOnce({ rejected: true });

    const res = await request(app).post('/feedback/suggestions/9/reject').send({}).expect(200);

    expect(rejectSuggestion).toHaveBeenCalledWith(9, 55, 'Not applicable');
    expect(res.body).toEqual({
      success: true,
      rejected: true,
      message: 'Suggestion rejected',
    });
  });

  it('runs full analysis', async () => {
    runFullAnalysis.mockResolvedValueOnce({ analyzed: 6 });

    const res = await request(app).post('/feedback/analyze-all').send({}).expect(200);

    expect(res.body).toEqual({ success: true, analyzed: 6 });
  });
});
