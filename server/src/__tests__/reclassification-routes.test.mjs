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
import { createNamedStubModule } from './helpers/mockFactory.mjs';

const cancelBatch = jest.fn();
const createBatch = jest.fn();
const executeBatch = jest.fn();
const getBatchProgress = jest.fn();
const getBatchStatus = jest.fn();
const listBatches = jest.fn();
const pauseBatch = jest.fn();
const resumeBatch = jest.fn();
const retryItem = jest.fn();
const skipItem = jest.fn();
const validateBatch = jest.fn();

jest.unstable_mockModule('../services/reclassificationBatchService.mjs', () => createNamedStubModule('reclassificationBatchService', {
  cancelBatch,
  createBatch,
  executeBatch,
  getBatchProgress,
  getBatchStatus,
  listBatches,
  pauseBatch,
  resumeBatch,
  retryItem,
  skipItem,
  validateBatch,
}));

const { router: reclassificationRouter } = await import('../routes/reclassification.mjs');

describe('reclassification routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/reclassification', reclassificationRouter);
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

  test('POST /api/reclassification/batch/:id/item/:itemId/skip parses ids', async () => {
    skipItem.mockResolvedValueOnce({ success: true });

    await request(app)
      .post('/api/reclassification/batch/42/item/9/skip')
      .expect(200);

    expect(skipItem).toHaveBeenCalledWith(42, 9);
  });

  test('GET /api/reclassification/batch/:id returns 404 for missing batch', async () => {
    getBatchStatus.mockRejectedValueOnce(new Error('Batch not found'));

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
