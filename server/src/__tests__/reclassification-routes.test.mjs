/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createNamedServiceStub } from './helpers/mockFactory.mjs';

const { service: reclassificationBatchService, module: reclassificationBatchServiceModule } = createNamedServiceStub('reclassificationBatchService', [
  'cancelBatch',
  'createBatch',
  'executeBatch',
  'getBatchProgress',
  'getBatchStatus',
  'getBatchActivity',
  'listBatches',
  'pauseBatch',
  'resumeBatch',
  'retryItem',
  'skipItem',
  'validateBatch',
]);
const {
  createBatch,
  getBatchStatus,
  listBatches,
  skipItem,
  validateBatch,
} = reclassificationBatchService;

jest.unstable_mockModule('../services/reclassificationBatchService.mjs', () => reclassificationBatchServiceModule);

const { router: reclassificationRouter } = await import('../routes/reclassification.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

describe('reclassification routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/reclassification', reclassificationRouter);
    app.use(errorHandler);
  });

  test('GET activity passes only the cursor and disables HTTP caching', async () => {
    reclassificationBatchService.getBatchActivity.mockResolvedValue({ batches: [], nextCursor: null });
    const response = await request(app).get('/api/reclassification/batches/activity?after=0:7&limit=999999').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ batches: [], nextCursor: null });
    expect(reclassificationBatchService.getBatchActivity).toHaveBeenCalledWith('0:7');
    expect(reclassificationBatchService.executeBatch).not.toHaveBeenCalled();
  });

  test('POST /api/reclassification/batch validates items payload', async () => {
    const response = await request(app)
      .post('/api/reclassification/batch')
      .send({ items: [] })
      .expect(400);

    expect(response.body.error).toMatch(/items array/i);
    expect(createBatch).not.toHaveBeenCalled();
  });

  test('POST /api/reclassification/batch creates a batch', async () => {
    createBatch.mockResolvedValueOnce({ id: 7, status: 'pending' });

    const response = await request(app)
      .post('/api/reclassification/batch')
      .send({
        items: [{ classificationId: 11, targetLibraryId: 5 }],
        pauseOnError: false,
        createdBy: 'tester',
      })
      .expect(201);

    expect(response.body.id).toBe(7);
    expect(createBatch).toHaveBeenCalledWith(
      [{ classificationId: 11, targetLibraryId: 5 }],
      { pauseOnError: false, createdBy: 'tester' }
    );
  });

  test('POST /api/reclassification/batch/:id/validate parses batch id', async () => {
    validateBatch.mockResolvedValueOnce({ valid: true });

    const response = await request(app)
      .post('/api/reclassification/batch/42/validate')
      .expect(200);

    expect(response.body.valid).toBe(true);
    expect(validateBatch).toHaveBeenCalledWith(42);
  });

  test.each(['execute', 'resume'])('POST %s acknowledges durable intent with 202', async action => {
    const method = action === 'execute' ? 'executeBatch' : 'resumeBatch';
    reclassificationBatchService[method].mockResolvedValueOnce({ id: 42, status: 'executing' });
    const response = await request(app).post(`/api/reclassification/batch/42/${action}`).expect(202);
    expect(response.body).toMatchObject({ id: 42, status: 'executing' });
    expect(reclassificationBatchService[method]).toHaveBeenCalledWith(42);
  });

  test('POST /api/reclassification/batch/:id/item/:itemId/skip parses ids', async () => {
    skipItem.mockResolvedValueOnce({ success: true });

    await request(app)
      .post('/api/reclassification/batch/42/item/9/skip')
      .expect(200);

    expect(skipItem).toHaveBeenCalledWith(42, 9);
  });

  test('GET /api/reclassification/batch/:id returns 404 for missing batch', async () => {
    const { NotFoundError } = await import('../utils/appError.mjs');
    getBatchStatus.mockRejectedValueOnce(new NotFoundError('Batch not found'));

    const response = await request(app)
      .get('/api/reclassification/batch/404')
      .expect(404);

    expect(response.body.error).toMatch(/batch not found/i);
  });

  test('GET /api/reclassification/batches defaults invalid limit to 20', async () => {
    listBatches.mockResolvedValueOnce([]);

    await request(app)
      .get('/api/reclassification/batches?limit=invalid')
      .expect(200);

    expect(listBatches).toHaveBeenCalledWith(20);
  });
});
