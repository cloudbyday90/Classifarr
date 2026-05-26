/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';
import {
  parseBatchListLimit,
  parsePositiveInt,
} from './reclassificationRouteHelpers.mjs';

export function createReclassificationRouter({ express, reclassificationBatchService }) {
  const router = express.Router();

  /**
   * @swagger
   * /api/reclassification/batch:
   *   post:
   *     summary: Create a new reclassification batch
   *     description: Create a batch of items to reclassify with optional pause-on-error
   */
  router.post('/batch', asyncHandler(async (req, res) => {
    const { items, pauseOnError = true, createdBy = 'user' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('items array is required and must not be empty');
    }

    const batch = await reclassificationBatchService.createBatch(items, { pauseOnError, createdBy });
    sendData(res, batch, 201);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/validate:
   *   post:
   *     summary: Validate a batch before execution
   *     description: Runs pre-flight checks on all items
   */
  router.post('/batch/:id/validate', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const result = await reclassificationBatchService.validateBatch(id);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/execute:
   *   post:
   *     summary: Execute a validated batch
   *     description: Starts executing the reclassification batch
   */
  router.post('/batch/:id/execute', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const result = await reclassificationBatchService.executeBatch(id);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/pause:
   *   post:
   *     summary: Pause a running batch
   */
  router.post('/batch/:id/pause', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const result = await reclassificationBatchService.pauseBatch(id);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/resume:
   *   post:
   *     summary: Resume a paused batch
   */
  router.post('/batch/:id/resume', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const result = await reclassificationBatchService.resumeBatch(id);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/cancel:
   *   post:
   *     summary: Cancel a batch and remaining items
   */
  router.post('/batch/:id/cancel', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const result = await reclassificationBatchService.cancelBatch(id);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/item/{itemId}/skip:
   *   post:
   *     summary: Skip a failed item and continue
   */
  router.post('/batch/:id/item/:itemId/skip', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const itemId = parsePositiveInt(req.params.itemId);
    const result = await reclassificationBatchService.skipItem(id, itemId);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/item/{itemId}/retry:
   *   post:
   *     summary: Retry a failed item
   */
  router.post('/batch/:id/item/:itemId/retry', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const itemId = parsePositiveInt(req.params.itemId);
    const result = await reclassificationBatchService.retryItem(id, itemId);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}:
   *   get:
   *     summary: Get full batch status with all items
   */
  router.get('/batch/:id', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const result = await reclassificationBatchService.getBatchStatus(id);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batch/{id}/progress:
   *   get:
   *     summary: Get batch progress (lightweight for polling)
   */
  router.get('/batch/:id/progress', asyncHandler(async (req, res) => {
    const id = parsePositiveInt(req.params.id);
    const result = await reclassificationBatchService.getBatchProgress(id);
    sendData(res, result);
  }));

  /**
   * @swagger
   * /api/reclassification/batches:
   *   get:
   *     summary: List recent batches
   */
  router.get('/batches', asyncHandler(async (req, res) => {
    const limit = parseBatchListLimit(req.query.limit);
    const result = await reclassificationBatchService.listBatches(limit);
    sendData(res, result);
  }));

  return router;
}
