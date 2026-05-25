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
import { sendData, sendError } from '../utils/responseHelpers.mjs';
import { ValidationError, NotFoundError, ConflictError } from '../utils/appError.mjs';

const VALID_RETRY_ENRICHMENT_TYPES = new Set(['tavily', 'omdb']);
const MAX_QUEUE_LIST_LIMIT = 100;
const MAX_RETRY_PROCESS_LIMIT = 200;

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function requireValidPositiveInt(value, label, code) {
  const parsed = parsePositiveInteger(value);
  if (!parsed) {
    throw new ValidationError(`Valid ${label} is required`, { code });
  }
  return parsed;
}

function parseLimit(value, defaultValue, maxValue) {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parsePositiveInteger(value);
  if (!parsed) {
    return null;
  }
  return parsed <= maxValue ? parsed : null;
}

function requireValidLimit(value, defaultValue, maxValue, code) {
  const limit = parseLimit(value, defaultValue, maxValue);
  if (!limit) {
    throw new ValidationError(`Valid positive limit up to ${maxValue} is required`, { code, max: maxValue });
  }
  return limit;
}

function parseRetryEnrichmentType(value) {
  if (value === undefined) {
    return 'tavily';
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return VALID_RETRY_ENRICHMENT_TYPES.has(normalized) ? normalized : null;
}

function sendMutationResult(res, result, successStatus = 200) {
  if (result?.success) {
    return sendData(res, result, successStatus);
  }

  if (result?.code === 'not_found' || result?.code === 'task_not_found' || result?.code === 'library_not_found') {
    throw new NotFoundError(result.code === 'library_not_found' ? 'Library not found' : 'Task not found', { code: result.code });
  }

  if (result?.code === 'invalid_state') {
    throw new ConflictError('Task is not in a valid state for this action', { code: result.code, currentStatus: result.currentStatus || null });
  }

  if (result?.code === 'invalid_task_type') {
    throw new ConflictError('Task type does not support manual classification', { code: result.code, taskType: result.taskType || null });
  }

  return sendError(res, 'Queue action failed', 500, { code: result?.code || 'queue_action_failed' });
}

function sendBulkMutationResult(res, result) {
  if (result?.success) {
    return sendData(res, result);
  }

  return sendError(res, 'Queue bulk action failed', 500, { code: result?.code || 'queue_action_failed', action: result?.action || null });
}

export function createQueueRouter({ express, queueService, logger, authenticateTokenOrApiKey, requireReadWrite }) {
  const router = express.Router();

  router.use(authenticateTokenOrApiKey);

  router.get('/ollama-status', asyncHandler(async (_req, res) => {
    const status = queueService.getOllamaStatus();
    return sendData(res, status);
  }));

  router.get('/stats', asyncHandler(async (_req, res) => {
    const stats = await queueService.getStats();
    return sendData(res, stats);
  }));

  router.get('/gap-analysis-stats', asyncHandler(async (_req, res) => {
    const stats = await queueService.getGapAnalysisStats();
    return sendData(res, stats);
  }));

  router.get('/live-stats', asyncHandler(async (_req, res) => {
    const stats = await queueService.getLiveStats();
    return sendData(res, stats);
  }));

  router.get('/pending', asyncHandler(async (req, res) => {
    const limit = requireValidLimit(req.query.limit, 20, MAX_QUEUE_LIST_LIMIT, 'invalid_limit');
    const tasks = await queueService.getPendingTasks(limit);
    return sendData(res, tasks);
  }));

  router.get('/failed', asyncHandler(async (req, res) => {
    const limit = requireValidLimit(req.query.limit, 20, MAX_QUEUE_LIST_LIMIT, 'invalid_limit');
    const tasks = await queueService.getFailedTasks(limit);
    return sendData(res, tasks);
  }));

  router.post('/task/:id/retry', requireReadWrite, asyncHandler(async (req, res) => {
    const taskId = requireValidPositiveInt(req.params.id, 'task id', 'invalid_task_id');
    const result = await queueService.retryTask(taskId);
    return sendMutationResult(res, result);
  }));

  router.post('/task/:id/dismiss', requireReadWrite, asyncHandler(async (req, res) => {
    const taskId = requireValidPositiveInt(req.params.id, 'task id', 'invalid_task_id');
    const result = await queueService.dismissFailedTask(taskId);
    return sendMutationResult(res, result);
  }));

  router.post('/task/:id/cancel', requireReadWrite, asyncHandler(async (req, res) => {
    const taskId = requireValidPositiveInt(req.params.id, 'task id', 'invalid_task_id');
    const result = await queueService.cancelTask(taskId);
    return sendMutationResult(res, result);
  }));

  router.post('/clear-completed', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await queueService.clearCompletedTasks();
    if (result?.success) {
      logger.info('Cleared completed tasks', { count: result.count });
    }
    return sendBulkMutationResult(res, result);
  }));

  router.post('/clear-failed', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await queueService.clearFailedTasks();
    if (result?.success) {
      logger.info('Cleared failed tasks', { count: result.count });
    }
    return sendBulkMutationResult(res, result);
  }));

  router.post('/retry-all-failed', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await queueService.retryAllFailedTasks();
    if (result?.success) {
      logger.info('Queued all failed tasks for retry', { count: result.count });
    }
    return sendBulkMutationResult(res, result);
  }));

  router.post('/cancel-all-pending', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await queueService.cancelAllPendingTasks();
    if (result?.success) {
      logger.info('Cancelled all pending tasks', { count: result.count });
    }
    return sendBulkMutationResult(res, result);
  }));

  router.post('/reprocess-completed', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await queueService.reprocessCompleted();
    if (result?.success) {
      logger.info('Queued completed items for reprocessing', { count: result.count });
    }
    return sendBulkMutationResult(res, result);
  }));

  router.post('/clear-and-resync', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await queueService.clearAndResync();
    logger.info('Cleared queue and triggered resync', result);
    return sendData(res, result);
  }));

  router.post('/tasks/:id/classify', requireReadWrite, asyncHandler(async (req, res) => {
    const taskId = requireValidPositiveInt(req.params.id, 'task id', 'invalid_task_id');
    const { resolved_by = 'admin' } = req.body;
    const libraryId = requireValidPositiveInt(req.body.library_id, 'library_id', 'invalid_library_id');

    const result = await queueService.manualClassifyTask(taskId, libraryId, resolved_by);
    return sendMutationResult(res, result);
  }));

  router.get('/retry-stats', asyncHandler(async (_req, res) => {
    const stats = await queueService.getEnrichmentRetryStats();
    return sendData(res, stats);
  }));

  router.post('/retry-process', requireReadWrite, asyncHandler(async (req, res) => {
    const limit = requireValidLimit(req.body?.limit, 50, MAX_RETRY_PROCESS_LIMIT, 'invalid_limit');
    const enrichmentType = parseRetryEnrichmentType(req.body?.enrichmentType);

    if (!enrichmentType) {
      throw new ValidationError('Valid enrichmentType is required', { code: 'invalid_enrichment_type', allowed: Array.from(VALID_RETRY_ENRICHMENT_TYPES) });
    }

    const result = await queueService.processEnrichmentRetryQueue(limit, enrichmentType);
    return sendData(res, result);
  }));

  router.post('/retry-backfill', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await queueService.backfillEnrichmentRetryQueue();
    return sendData(res, result);
  }));

  return router;
}
