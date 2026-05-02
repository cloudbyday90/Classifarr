/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const VALID_RETRY_ENRICHMENT_TYPES = new Set(['tavily', 'omdb']);
const MAX_QUEUE_LIST_LIMIT = 100;
const MAX_RETRY_PROCESS_LIMIT = 200;

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
    return res.status(successStatus).json(result);
  }

  if (result?.code === 'not_found' || result?.code === 'task_not_found' || result?.code === 'library_not_found') {
    return res.status(404).json({
      error: result.code === 'library_not_found' ? 'Library not found' : 'Task not found',
      code: result.code,
    });
  }

  if (result?.code === 'invalid_state') {
    return res.status(409).json({
      error: 'Task is not in a valid state for this action',
      code: result.code,
      currentStatus: result.currentStatus || null,
    });
  }

  if (result?.code === 'invalid_task_type') {
    return res.status(409).json({
      error: 'Task type does not support manual classification',
      code: result.code,
      taskType: result.taskType || null,
    });
  }

  return res.status(500).json({
    error: 'Queue action failed',
    code: result?.code || 'queue_action_failed',
  });
}

function sendBulkMutationResult(res, result) {
  if (result?.success) {
    return res.status(200).json(result);
  }

  return res.status(500).json({
    error: 'Queue bulk action failed',
    code: result?.code || 'queue_action_failed',
    action: result?.action || null,
  });
}

export function createQueueRouter({ express, queueService, logger, authenticateTokenOrApiKey, requireReadWrite }) {
  const router = express.Router();

  router.use(authenticateTokenOrApiKey);

  router.get('/ollama-status', async (_req, res) => {
    try {
      const status = queueService.getOllamaStatus();
      return res.json(status);
    } catch (error) {
      logger.error('Failed to get ollama status', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/stats', async (_req, res) => {
    try {
      const stats = await queueService.getStats();
      return res.json(stats);
    } catch (error) {
      logger.error('Failed to get queue stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/gap-analysis-stats', async (_req, res) => {
    try {
      const stats = await queueService.getGapAnalysisStats();
      return res.json(stats);
    } catch (error) {
      logger.error('Failed to get gap analysis stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/live-stats', async (_req, res) => {
    try {
      const stats = await queueService.getLiveStats();
      return res.json(stats);
    } catch (error) {
      logger.error('Failed to get live stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/pending', async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 20, MAX_QUEUE_LIST_LIMIT);
      if (!limit) {
        return res.status(400).json({
          error: `Valid positive limit up to ${MAX_QUEUE_LIST_LIMIT} is required`,
          code: 'invalid_limit',
          max: MAX_QUEUE_LIST_LIMIT,
        });
      }
      const tasks = await queueService.getPendingTasks(limit);
      return res.json(tasks);
    } catch (error) {
      logger.error('Failed to get pending tasks', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/failed', async (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 20, MAX_QUEUE_LIST_LIMIT);
      if (!limit) {
        return res.status(400).json({
          error: `Valid positive limit up to ${MAX_QUEUE_LIST_LIMIT} is required`,
          code: 'invalid_limit',
          max: MAX_QUEUE_LIST_LIMIT,
        });
      }
      const tasks = await queueService.getFailedTasks(limit);
      return res.json(tasks);
    } catch (error) {
      logger.error('Failed to get failed tasks', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/task/:id/retry', requireReadWrite, async (req, res) => {
    try {
      const taskId = parsePositiveInteger(req.params.id);
      if (!taskId) {
        return res.status(400).json({ error: 'Valid task id is required', code: 'invalid_task_id' });
      }
      const result = await queueService.retryTask(taskId);
      return sendMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to retry task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/task/:id/dismiss', requireReadWrite, async (req, res) => {
    try {
      const taskId = parsePositiveInteger(req.params.id);
      if (!taskId) {
        return res.status(400).json({ error: 'Valid task id is required', code: 'invalid_task_id' });
      }
      const result = await queueService.dismissFailedTask(taskId);
      return sendMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to dismiss task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/task/:id/cancel', requireReadWrite, async (req, res) => {
    try {
      const taskId = parsePositiveInteger(req.params.id);
      if (!taskId) {
        return res.status(400).json({ error: 'Valid task id is required', code: 'invalid_task_id' });
      }
      const result = await queueService.cancelTask(taskId);
      return sendMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to cancel task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/clear-completed', requireReadWrite, async (_req, res) => {
    try {
      const result = await queueService.clearCompletedTasks();
      if (result?.success) {
        logger.info('Cleared completed tasks', { count: result.count });
      }
      return sendBulkMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to clear completed tasks', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/clear-failed', requireReadWrite, async (_req, res) => {
    try {
      const result = await queueService.clearFailedTasks();
      if (result?.success) {
        logger.info('Cleared failed tasks', { count: result.count });
      }
      return sendBulkMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to clear failed tasks', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/retry-all-failed', requireReadWrite, async (_req, res) => {
    try {
      const result = await queueService.retryAllFailedTasks();
      if (result?.success) {
        logger.info('Queued all failed tasks for retry', { count: result.count });
      }
      return sendBulkMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to retry all tasks', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/cancel-all-pending', requireReadWrite, async (_req, res) => {
    try {
      const result = await queueService.cancelAllPendingTasks();
      if (result?.success) {
        logger.info('Cancelled all pending tasks', { count: result.count });
      }
      return sendBulkMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to cancel all tasks', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/reprocess-completed', requireReadWrite, async (_req, res) => {
    try {
      const result = await queueService.reprocessCompleted();
      if (result?.success) {
        logger.info('Queued completed items for reprocessing', { count: result.count });
      }
      return sendBulkMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to reprocess completed', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/clear-and-resync', requireReadWrite, async (_req, res) => {
    try {
      const result = await queueService.clearAndResync();
      logger.info('Cleared queue and triggered resync', result);
      return res.json(result);
    } catch (error) {
      logger.error('Failed to clear and resync', {
        error: error.message,
        code: error.code || null,
        details: error.details || null,
      });
      return res.status(500).json({
        error: error.message,
        code: error.code || 'CARSA_RESET_FAILED',
        details: error.details || null,
      });
    }
  });

  router.post('/tasks/:id/classify', requireReadWrite, async (req, res) => {
    try {
      const taskId = parsePositiveInteger(req.params.id);
      const { library_id, resolved_by = 'admin' } = req.body;
      const libraryId = parsePositiveInteger(library_id);

      if (!taskId) {
        return res.status(400).json({ error: 'Valid task id is required', code: 'invalid_task_id' });
      }

      if (!libraryId) {
        return res.status(400).json({ error: 'Valid library_id is required', code: 'invalid_library_id' });
      }

      const result = await queueService.manualClassifyTask(taskId, libraryId, resolved_by);
      return sendMutationResult(res, result);
    } catch (error) {
      logger.error('Failed to manually classify task', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/retry-stats', async (_req, res) => {
    try {
      const stats = await queueService.getEnrichmentRetryStats();
      return res.json(stats);
    } catch (error) {
      logger.error('Failed to get retry stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/retry-process', requireReadWrite, async (req, res) => {
    try {
      const limit = parseLimit(req.body?.limit, 50, MAX_RETRY_PROCESS_LIMIT);
      const enrichmentType = parseRetryEnrichmentType(req.body?.enrichmentType);

      if (!limit) {
        return res.status(400).json({
          error: `Valid positive limit up to ${MAX_RETRY_PROCESS_LIMIT} is required`,
          code: 'invalid_limit',
          max: MAX_RETRY_PROCESS_LIMIT,
        });
      }

      if (!enrichmentType) {
        return res.status(400).json({
          error: 'Valid enrichmentType is required',
          code: 'invalid_enrichment_type',
          allowed: Array.from(VALID_RETRY_ENRICHMENT_TYPES),
        });
      }

      const result = await queueService.processEnrichmentRetryQueue(limit, enrichmentType);
      return res.json(result);
    } catch (error) {
      logger.error('Failed to process retry queue', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/retry-backfill', requireReadWrite, async (_req, res) => {
    try {
      const result = await queueService.backfillEnrichmentRetryQueue();
      return res.json(result);
    } catch (error) {
      logger.error('Failed to backfill retry queue', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}