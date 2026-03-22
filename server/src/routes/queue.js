/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Queue management API routes
 */

const express = require('express');
const router = express.Router();
const queueService = require('../services/queueService');
const { createLogger } = require('../utils/logger');
const { authenticateTokenOrApiKey, requireReadWrite } = require('../middleware/apiKeyAuth');

const logger = createLogger('QueueRoutes');
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

// Apply authentication to all queue routes
router.use(authenticateTokenOrApiKey);

/**
 * @swagger
 * /api/queue/ollama-status:
 *   get:
 *     summary: Get current Ollama generation status
 *     responses:
 *       200:
 *         description: Current AI generation status including model, tokens, and item being processed
 */
router.get('/ollama-status', async (req, res) => {
    try {
        const status = queueService.getOllamaStatus();
        res.json(status);
    } catch (error) {
        logger.error('Failed to get ollama status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/stats:
 *   get:
 *     summary: Get queue statistics
 *     responses:
 *       200:
 *         description: Queue statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await queueService.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get queue stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/gap-analysis-stats:
 *   get:
 *     summary: Get gap analysis progress stats
 *     responses:
 *       200:
 *         description: Gap analysis statistics including unprocessed items
 */
router.get('/gap-analysis-stats', async (req, res) => {
    try {
        const stats = await queueService.getGapAnalysisStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get gap analysis stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/live-stats:
 *   get:
 *     summary: Get combined live stats for dashboard
 *     responses:
 *       200:
 *         description: Combined queue, gap analysis, and system health stats
 */
router.get('/live-stats', async (req, res) => {
    try {
        const stats = await queueService.getLiveStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get live stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/pending:
 *   get:
 *     summary: Get pending tasks
 *     responses:
 *       200:
 *         description: List of pending tasks
 */
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
        res.json(tasks);
    } catch (error) {
        logger.error('Failed to get pending tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/failed:
 *   get:
 *     summary: Get failed tasks
 *     responses:
 *       200:
 *         description: List of failed tasks
 */
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
        res.json(tasks);
    } catch (error) {
        logger.error('Failed to get failed tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/task/{id}/retry:
 *   post:
 *     summary: Retry a failed task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/task/:id/retry', requireReadWrite, async (req, res) => {
    try {
        const taskId = parsePositiveInteger(req.params.id);
        if (!taskId) {
            return res.status(400).json({ error: 'Valid task id is required', code: 'invalid_task_id' });
        }
        const result = await queueService.retryTask(taskId);
        sendMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to retry task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/task/{id}/dismiss:
 *   post:
 *     summary: Dismiss a failed task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/task/:id/dismiss', requireReadWrite, async (req, res) => {
    try {
        const taskId = parsePositiveInteger(req.params.id);
        if (!taskId) {
            return res.status(400).json({ error: 'Valid task id is required', code: 'invalid_task_id' });
        }
        const result = await queueService.dismissFailedTask(taskId);
        sendMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to dismiss task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/task/{id}/cancel:
 *   post:
 *     summary: Cancel a pending task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/task/:id/cancel', requireReadWrite, async (req, res) => {
    try {
        const taskId = parsePositiveInteger(req.params.id);
        if (!taskId) {
            return res.status(400).json({ error: 'Valid task id is required', code: 'invalid_task_id' });
        }
        const result = await queueService.cancelTask(taskId);
        sendMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to cancel task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/clear-completed:
 *   post:
 *     summary: Clear all completed tasks
 */
router.post('/clear-completed', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.clearCompletedTasks();
        if (result?.success) {
            logger.info('Cleared completed tasks', { count: result.count });
        }
        sendBulkMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to clear completed tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/clear-failed:
 *   post:
 *     summary: Clear all failed tasks
 */
router.post('/clear-failed', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.clearFailedTasks();
        if (result?.success) {
            logger.info('Cleared failed tasks', { count: result.count });
        }
        sendBulkMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to clear failed tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/retry-all-failed:
 *   post:
 *     summary: Retry all failed tasks
 */
router.post('/retry-all-failed', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.retryAllFailedTasks();
        if (result?.success) {
            logger.info('Queued all failed tasks for retry', { count: result.count });
        }
        sendBulkMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to retry all tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/cancel-all-pending:
 *   post:
 *     summary: Cancel all pending tasks
 */
router.post('/cancel-all-pending', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.cancelAllPendingTasks();
        if (result?.success) {
            logger.info('Cancelled all pending tasks', { count: result.count });
        }
        sendBulkMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to cancel all tasks', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/reprocess-completed:
 *   post:
 *     summary: Re-queue all completed classifications for reprocessing
 */
router.post('/reprocess-completed', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.reprocessCompleted();
        if (result?.success) {
            logger.info('Queued completed items for reprocessing', { count: result.count });
        }
        sendBulkMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to reprocess completed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/clear-and-resync:
 *   post:
 *     summary: Clear all queue data and trigger fresh library sync
 */
router.post('/clear-and-resync', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.clearAndResync();
        logger.info('Cleared queue and triggered resync', result);
        res.json(result);
    } catch (error) {
        logger.error('Failed to clear and resync', {
            error: error.message,
            code: error.code || null,
            details: error.details || null
        });
        res.status(500).json({
            error: error.message,
            code: error.code || 'CARSA_RESET_FAILED',
            details: error.details || null
        });
    }
});

/**
 * @swagger
 * /api/queue/tasks/{id}/classify:
 *   post:
 *     summary: Manually classify a pending task, bypassing AI
 *     description: Admin can pick a task from the pending queue and assign it to a library directly
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
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
        sendMutationResult(res, result);
    } catch (error) {
        logger.error('Failed to manually classify task', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ========== ENRICHMENT RETRY QUEUE ENDPOINTS ==========

/**
 * @swagger
 * /api/queue/retry-stats:
 *   get:
 *     summary: Get enrichment retry queue statistics
 *     responses:
 *       200:
 *         description: Retry queue statistics by type and status
 */
router.get('/retry-stats', async (req, res) => {
    try {
        const stats = await queueService.getEnrichmentRetryStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get retry stats', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/retry-process:
 *   post:
 *     summary: Process pending items in the retry queue
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 default: 50
 *               enrichmentType:
 *                 type: string
 *                 default: tavily
 *                 enum: [tavily, omdb]
 *     responses:
 *       200:
 *         description: Processing result
 */
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
        res.json(result);
    } catch (error) {
        logger.error('Failed to process retry queue', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/queue/retry-backfill:
 *   post:
 *     summary: Backfill Tavily retry queue with items missing OMDb data
 *     responses:
 *       200:
 *         description: Number of items queued for Tavily fallback enrichment
 */
router.post('/retry-backfill', requireReadWrite, async (req, res) => {
    try {
        const result = await queueService.backfillEnrichmentRetryQueue();
        res.json(result);
    } catch (error) {
        logger.error('Failed to backfill retry queue', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
