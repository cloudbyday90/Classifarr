/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import request from 'supertest';
import { request as httpRequest } from 'node:http';
import { setImmediate } from 'node:timers/promises';
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
  'runSummaryAnalysis',
]);
const {
  getPendingSuggestions,
  analyzePolicy,
  applySuggestion,
  rejectSuggestion,
  runFullAnalysis,
  runSummaryAnalysis,
} = feedbackAnalysis;
const query = jest.fn();
const recordStandaloneFeedback = jest.fn();
jest.unstable_mockModule('../services/standaloneFeedbackService.mjs', () => ({ recordStandaloneFeedback }));

jest.unstable_mockModule('../services/feedbackAnalysis.mjs', () => feedbackAnalysisModule);

jest.unstable_mockModule('../config/database.mjs', () => createStandardDbMock(query));

const { logger, module: loggerModule } = createLoggerModuleMock();
jest.unstable_mockModule('../utils/logger.mjs', () => loggerModule);

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
          req.user = { id: 55, role: 'admin' };
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

    expect(res.body.error).toContain('1 to 2147483647');
    expect(analyzePolicy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith('Manual suggestion analysis requested', expect.anything());
  });

  it('applies default analyze options when values are missing', async () => {
    analyzePolicy.mockResolvedValueOnce({ created: 4 });

    const res = await request(app)
      .post('/feedback/policies/7/analyze')
      .send({ actorId: 1, policyId: 42 })
      .expect(200);

    expect(analyzePolicy).toHaveBeenCalledWith(7, { days: 30, minFeedback: 5 });
    expect(logger.info.mock.calls).toEqual([['Manual suggestion analysis requested', { actorId: 55, scope: 'policy', policyId: 7 }]]);
    expect(res.body).toEqual({ success: true, created: 4 });
  });

  it.each([{ days: 366 }, { minFeedback: 1001 }])('refuses out-of-range options before logging or dispatching analysis', async options => {
    await request(app).post('/feedback/policies/7/analyze').send(options).expect(400);
    expect(analyzePolicy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith('Manual suggestion analysis requested', expect.anything());
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

    expect(res.body.error).toContain('1 to 2147483647');
    expect(applySuggestion).not.toHaveBeenCalled();
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
    expect(runSummaryAnalysis).not.toHaveBeenCalled();
    expect(logger.info.mock.calls).toEqual([['Manual suggestion analysis requested', { actorId: 55, scope: 'enabled_policies' }]]);
  });

  it('opts into compact summary and preserves the exact continuation', async () => {
    const result = { format: 'summary-v1', policiesAttempted: 0,
      counts: { completed: 0, insufficient_feedback: 0, unconfirmed: 0 }, nextAfterPolicyId: null, results: [] };
    runSummaryAnalysis.mockResolvedValueOnce(result);
    const response = await request(app).post('/feedback/analyze-all?format=summary-v1&afterPolicyId=2147483647')
      .send({}).expect(200, { success: true, ...result });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toMatch(/^application\/json/);
    expect(runSummaryAnalysis).toHaveBeenCalledWith(2147483647);
    expect(runFullAnalysis).not.toHaveBeenCalled();
  });

  it.each(['format=summary', 'format=summary-v1&format=summary-v1', 'format=summary-v1&limit=5000',
    'format=summary-v1&afterPolicyId=01', 'format=summary-v1&afterPolicyId=2147483648',
    'format=summary-v1&afterPolicyId=1&afterPolicyId=2'])('refuses malformed summary options before analysis (%s)', async params => {
    await request(app).post(`/feedback/analyze-all?${params}`).send({}).expect(400);
    expect(runSummaryAnalysis).not.toHaveBeenCalled();
    expect(runFullAnalysis).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith('Manual suggestion analysis requested', expect.anything());
  });

  it('records an accepted request before a failing analysis starts', async () => {
    const log = [['Manual suggestion analysis requested', { actorId: 55, scope: 'policy', policyId: 7 }]];
    let logAtDispatch;
    analyzePolicy.mockImplementationOnce(async () => {
      logAtDispatch = [...logger.info.mock.calls];
      throw new Error('Analysis failed');
    });

    await request(app).post('/feedback/policies/7/analyze').send({}).expect(500);

    expect(logAtDispatch).toEqual(log);
    expect(logger.info.mock.calls).toEqual(log);
    runFullAnalysis.mockResolvedValueOnce({ policiesAnalyzed: 0, results: [] });
    await request(app).post('/feedback/analyze-all').send({}).expect(200);
  });

  const policyAnalysis = '/feedback/policies/7/analyze';
  const allPolicyAnalysis = '/feedback/analyze-all';
  const summaryAnalysis = '/feedback/analyze-all?format=summary-v1';
  const analysisServices = new Map([[allPolicyAnalysis, runFullAnalysis], [summaryAnalysis, runSummaryAnalysis]]);
  const busyResponse = {
    code: 'SUGGESTION_ANALYSIS_BUSY',
    error: 'Manual analysis is already running. Try again after it finishes.',
  };

  it.each([
    [policyAnalysis, allPolicyAnalysis], [allPolicyAnalysis, policyAnalysis],
    [policyAnalysis, '/feedback/policies/8/analyze'], [allPolicyAnalysis, allPolicyAnalysis],
    [allPolicyAnalysis, summaryAnalysis], [summaryAnalysis, policyAnalysis],
  ])('keeps one slot when %s overlaps %s', async (firstPath, secondPath) => {
    const entered = Promise.withResolvers();
    const settle = Promise.withResolvers();
    const firstService = analysisServices.get(firstPath) ?? analyzePolicy;
    const secondService = analysisServices.get(secondPath) ?? analyzePolicy;
    firstService.mockImplementationOnce(() => {
      entered.resolve();
      return settle.promise;
    });
    const firstResponse = request(app).post(firstPath).send({}).timeout(3000).then(response => response);
    try {
      await Promise.race([entered.promise, firstResponse.then(() => { throw new Error('Analysis did not start'); })]);
      const busy = await request(app).post(secondPath).send({}).timeout(2000).expect(503);
      expect(busy.body).toEqual(busyResponse);
      expect(busy.headers['cache-control']).toBe('no-store');
      expect(busy.headers['retry-after']).toBeUndefined();
      await request(app).post('/feedback/policies/07/analyze').send({}).expect(400);
      await request(app).post(policyAnalysis).send({ days: 366 }).expect(400);
      expect(analyzePolicy.mock.calls.length + runFullAnalysis.mock.calls.length + runSummaryAnalysis.mock.calls.length).toBe(1);
      expect(logger.info).toHaveBeenCalledTimes(1);
    } finally {
      settle.resolve({ accepted: 'first' });
      expect(await firstResponse).toMatchObject({ status: 200, body: { success: true, accepted: 'first' } });
    }

    secondService.mockResolvedValueOnce({ accepted: 'later' });
    await request(app).post(secondPath).send({}).expect(200, { success: true, accepted: 'later' });
    expect(analyzePolicy.mock.calls.length + runFullAnalysis.mock.calls.length + runSummaryAnalysis.mock.calls.length).toBe(2);
  });

  it('retains its slot after disconnect until the running analysis settles', async () => {
    const entered = Promise.withResolvers();
    const settle = Promise.withResolvers();
    analyzePolicy.mockImplementationOnce(() => {
      entered.resolve();
      return settle.promise;
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => { server.once('listening', resolve); });
    const first = httpRequest({ hostname: '127.0.0.1', port: server.address().port, path: policyAnalysis, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '2' } });
    const closed = new Promise(resolve => { first.once('close', resolve); });
    const responseClosed = new Promise(resolve => { server.once('request', (_req, res) => res.once('close', resolve)); });
    first.on('error', () => {});
    first.end('{}');
    try {
      await Promise.race([entered.promise, closed.then(() => { throw new Error('Analysis did not start before disconnect'); })]);
      first.destroy();
      await responseClosed;
      await request(server).post(allPolicyAnalysis).send({}).expect(503, busyResponse);
      expect(runFullAnalysis).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledTimes(1);

      settle.resolve({ accepted: 'first' });
      await setImmediate();
      runFullAnalysis.mockResolvedValueOnce({ policiesAnalyzed: 0, results: [] });
      await request(server).post(allPolicyAnalysis).send({}).expect(200);
    } finally {
      settle.resolve({});
      first.destroy();
      server.closeAllConnections();
      await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
    }
  });
});
