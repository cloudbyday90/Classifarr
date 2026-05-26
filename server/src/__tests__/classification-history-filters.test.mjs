/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createDbRowsResult, createNamedMockModule, createServiceStubs } from './helpers/mockFactory.mjs';
import { errorHandler } from '../middleware/errorHandler.mjs';

const mockDb = {
  query: jest.fn(),
  pool: { connect: jest.fn() },
};
const mockClassification = createServiceStubs();
const mockReclassificationService = createServiceStubs();
const mockClarificationService = createServiceStubs();
const mockPatternReinforcementService = createServiceStubs();
const mockClassificationEvidenceReinforcementService = createServiceStubs(['reinforceOnAccept', 'reinforceOnCorrection']);
const mockLibraryProfileService = createServiceStubs();
const mockSignalCollector = { PATTERN_SIGNAL_TYPES: [] };

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/classification.mjs', () => createNamedMockModule('classificationService', mockClassification));

jest.unstable_mockModule('../services/reclassificationService.mjs', () => createNamedMockModule('reclassificationService', mockReclassificationService));

jest.unstable_mockModule('../services/clarificationService.mjs', () => createNamedMockModule('clarificationService', mockClarificationService));

jest.unstable_mockModule('../services/patternReinforcementService.mjs', () => createNamedMockModule('patternReinforcementService', mockPatternReinforcementService));

jest.unstable_mockModule('../services/classificationEvidenceReinforcementService.mjs', () => createNamedMockModule('classificationEvidenceReinforcementService', mockClassificationEvidenceReinforcementService));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => createNamedMockModule('libraryProfileService', mockLibraryProfileService));

jest.unstable_mockModule('../services/signalCollector.mjs', () => createNamedMockModule('SIGNAL_TYPES', mockSignalCollector));

const db = mockDb;
const { PATTERN_SIGNAL_TYPES } = mockSignalCollector;

const { createLogger } = await import('../utils/logger.mjs');
const { requireReadWrite } = await import('../middleware/apiKeyAuth.mjs');
const { STALE_AWAITING_DECISION_DAYS } = await import('../constants/classificationFlow.mjs');
const { createClassificationRouter } = await import('../routes/classificationRouteShared.mjs');

let app;

describe('Classification history filters', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/classification', createClassificationRouter({
      express,
      db,
      classificationService: {},
      classificationRetryService: {},
      classificationOutcomeService: {},
      clarificationService: {},
      classificationEvidenceService: {},
      classificationEvidenceReinforcementService: {},
      PATTERN_SIGNAL_TYPES,
      createLogger,
      requireReadWrite,
      STALE_AWAITING_DECISION_DAYS,
      reclassificationService: {},
    }));
    app.use(errorHandler);
  });

  test('applies search and date range filters to history query', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Motorvalley', media_type: 'tv', library_name: 'TV Shows', total_count: '1' },
        ],
      });

    const response = await request(app)
      .get('/api/classification/history')
      .query({
        page: 1,
        limit: 50,
        media_type: 'tv',
        library_id: 10,
        method: 'policy_engine',
        search: 'motor',
        date_from: '2026-02-10',
        date_to: '2026-02-12',
      })
      .expect(200);

    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });

    const [historyQueryText, historyQueryParams] = db.query.mock.calls[0];
    expect(historyQueryText).toContain('ch.title ILIKE');
    expect(historyQueryText).toContain('ch.created_at >=');
    expect(historyQueryText).toContain("ch.created_at < ($");
    expect(historyQueryParams).toEqual([
      'tv',
      '10',
      'policy_engine',
      '%motor%',
      '2026-02-10',
      '2026-02-12',
      50,
      0,
    ]);
  });

  test('normalizes page/limit bounds', async () => {
    db.query
      .mockResolvedValueOnce(createDbRowsResult())
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const response = await request(app)
      .get('/api/classification/history')
      .query({ page: 0, limit: 999 })
      .expect(200);

    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(200);

    const [, historyQueryParams] = db.query.mock.calls[0];
    const limitArg = historyQueryParams[historyQueryParams.length - 2];
    const offsetArg = historyQueryParams[historyQueryParams.length - 1];
    expect(limitArg).toBe(200);
    expect(offsetArg).toBe(0);
  });

  test('returns real total when requested page is beyond last result', async () => {
    db.query
      .mockResolvedValueOnce(createDbRowsResult())
      .mockResolvedValueOnce({ rows: [{ count: '42' }] });

    const response = await request(app)
      .get('/api/classification/history')
      .query({ page: 5, limit: 10 })
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.pagination).toMatchObject({
      page: 5,
      limit: 10,
      total: 42,
      totalPages: 5,
    });

    expect(db.query).toHaveBeenCalledTimes(2);
    const [countQueryText, countQueryParams] = db.query.mock.calls[1];
    expect(countQueryText).toContain('COUNT(*)');
    expect(countQueryParams).not.toContain(10);
    expect(countQueryParams).not.toContain(40);
  });

  test('uses single query (no fallback COUNT) when rows are returned', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, title: 'Alpha', media_type: 'movie', library_name: 'Movies', total_count: '3' },
          { id: 2, title: 'Beta',  media_type: 'movie', library_name: 'Movies', total_count: '3' },
        ],
      });

    const response = await request(app)
      .get('/api/classification/history')
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body.pagination).toMatchObject({ total: 3, totalPages: 1 });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(response.body.data[0]).not.toHaveProperty('total_count');
  });

  test('fallback COUNT reuses the same filter params (no LIMIT/OFFSET injected)', async () => {
    db.query
      .mockResolvedValueOnce(createDbRowsResult())
      .mockResolvedValueOnce({ rows: [{ count: '7' }] });

    await request(app)
      .get('/api/classification/history')
      .query({ page: 99, limit: 50, media_type: 'tv', library_id: 5 })
      .expect(200);

    const [, dataParams]  = db.query.mock.calls[0];
    const [, countParams] = db.query.mock.calls[1];

    expect(countParams).toEqual(dataParams.slice(0, -2));
  });
});
