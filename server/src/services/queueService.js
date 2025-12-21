/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const classificationService = require('./classification');

const logger = createLogger('QueueService');

// Configuration
const POLL_INTERVAL_MS = 5000;  // Check queue every 5 seconds
const MAX_CONCURRENT = 1;       // Process one at a time to avoid overloading Ollama
const RETRY_DELAYS = [30, 60, 120, 300, 600]; // Seconds: 30s, 1m, 2m, 5m, 10m

class QueueService {
    constructor() {
        this.running = false;
        this.processing = 0;
        this.ollamaAvailable = true;
    }

    /**
     * Add a task to the queue
     */
    async enqueue(taskType, payload, options = {}) {
        const { priority = 0, webhookLogId = null, source = 'webhook', maxAttempts = 5 } = options;

        try {
            const result = await db.query(
                `INSERT INTO task_queue (task_type, payload, priority, webhook_log_id, source, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
                [taskType, JSON.stringify(payload), priority, webhookLogId, source, maxAttempts]
            );

            const taskId = result.rows[0].id;
            logger.info('Task enqueued', { taskId, taskType, source });
            return taskId;
        } catch (error) {
            logger.error('Failed to enqueue task', { error: error.message, taskType });
            throw error;
        }
    }

    /**
     * Get the next pending task
     */
    async dequeue() {
        try {
            const result = await db.query(
                `UPDATE task_queue
         SET status = 'processing', started_at = NOW()
         WHERE id = (
           SELECT id FROM task_queue
           WHERE status = 'pending' AND next_retry_at <= NOW()
           ORDER BY priority DESC, created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`
            );

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to dequeue task', { error: error.message });
            return null;
        }
    }

    /**
     * Mark task as completed
     */
    async completeTask(taskId, result = {}) {
        try {
            await db.query(
                `UPDATE task_queue
         SET status = 'completed', completed_at = NOW(), payload = payload || $2
         WHERE id = $1`,
                [taskId, JSON.stringify({ result })]
            );
            logger.info('Task completed', { taskId });
        } catch (error) {
            logger.error('Failed to complete task', { error: error.message, taskId });
        }
    }

    /**
     * Mark task as failed with retry logic
     */
    async failTask(taskId, errorMessage, currentAttempts, maxAttempts) {
        const nextAttempt = currentAttempts + 1;

        try {
            if (nextAttempt >= maxAttempts) {
                // Permanently failed
                await db.query(
                    `UPDATE task_queue
           SET status = 'failed', error_message = $2, attempts = $3, completed_at = NOW()
           WHERE id = $1`,
                    [taskId, errorMessage, nextAttempt]
                );
                logger.error('Task permanently failed', { taskId, attempts: nextAttempt });
            } else {
                // Schedule retry with exponential backoff
                const delaySeconds = RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)];
                await db.query(
                    `UPDATE task_queue
           SET status = 'pending', error_message = $2, attempts = $3,
               next_retry_at = NOW() + INTERVAL '${delaySeconds} seconds',
               started_at = NULL
           WHERE id = $1`,
                    [taskId, errorMessage, nextAttempt]
                );
                logger.warn('Task scheduled for retry', { taskId, attempt: nextAttempt, delaySeconds });
            }
        } catch (error) {
            logger.error('Failed to update task status', { error: error.message, taskId });
        }
    }

    /**
     * Check if Ollama is available
     */
    async checkOllamaAvailability() {
        try {
            // Get AI config
            const configResult = await db.query('SELECT * FROM ollama_config LIMIT 1');
            if (!configResult.rows[0]) {
                return false;
            }

            const config = configResult.rows[0];
            const host = config.host || 'host.docker.internal';
            const port = config.port || 11434;
            const ollamaUrl = `http://${host}:${port}`;

            // Quick health check
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${ollamaUrl}/api/tags`, {
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.ok) {
                if (!this.ollamaAvailable) {
                    logger.info('Ollama is now available');
                }
                this.ollamaAvailable = true;
                return true;
            }

            return false;
        } catch (error) {
            if (this.ollamaAvailable) {
                logger.warn('Ollama is offline', { error: error.message });
            }
            this.ollamaAvailable = false;
            return false;
        }
    }

    /**
     * Process a single task
     */
    async processTask(task) {
        logger.info('Processing task', { taskId: task.id, taskType: task.task_type });

        try {
            switch (task.task_type) {
                case 'classification':
                    const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                    const result = await classificationService.classify(payload);
                    await this.completeTask(task.id, result);

                    // Update webhook_log if linked
                    if (task.webhook_log_id) {
                        await db.query(
                            `UPDATE webhook_log SET processing_status = 'completed', 
               routed_to_library = $2, processing_time_ms = EXTRACT(EPOCH FROM (NOW() - $3)) * 1000
               WHERE id = $1`,
                            [task.webhook_log_id, result.library?.name, task.started_at]
                        );
                    }
                    break;

                default:
                    logger.warn('Unknown task type', { taskType: task.task_type });
                    await this.failTask(task.id, `Unknown task type: ${task.task_type}`, task.attempts, task.max_attempts);
            }
        } catch (error) {
            logger.error('Task processing failed', { taskId: task.id, error: error.message });
            await this.failTask(task.id, error.message, task.attempts, task.max_attempts);

            // Update webhook_log if linked
            if (task.webhook_log_id) {
                await db.query(
                    `UPDATE webhook_log SET processing_status = 'failed', error_message = $2 WHERE id = $1`,
                    [task.webhook_log_id, error.message]
                );
            }
        }
    }

    /**
     * Main worker loop
     */
    async startWorker() {
        if (this.running) {
            logger.warn('Worker already running');
            return;
        }

        this.running = true;
        logger.info('Queue worker started');

        while (this.running) {
            try {
                // Check if Ollama is available before processing
                const ollamaReady = await this.checkOllamaAvailability();

                if (ollamaReady && this.processing < MAX_CONCURRENT) {
                    const task = await this.dequeue();

                    if (task) {
                        this.processing++;
                        this.processTask(task).finally(() => {
                            this.processing--;
                        });
                    }
                }
            } catch (error) {
                logger.error('Worker loop error', { error: error.message });
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        logger.info('Queue worker stopped');
    }

    /**
     * Stop the worker
     */
    stopWorker() {
        this.running = false;
        logger.info('Queue worker stopping...');
    }

    /**
     * Get queue statistics
     */
    async getStats() {
        try {
            const result = await db.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM task_queue
        GROUP BY status
      `);

            const stats = {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
                total: 0
            };

            for (const row of result.rows) {
                stats[row.status] = parseInt(row.count);
                stats.total += parseInt(row.count);
            }

            stats.ollamaAvailable = this.ollamaAvailable;
            stats.workerRunning = this.running;

            return stats;
        } catch (error) {
            logger.error('Failed to get queue stats', { error: error.message });
            return null;
        }
    }

    /**
     * Get pending tasks
     */
    async getPendingTasks(limit = 20) {
        try {
            const result = await db.query(
                `SELECT id, task_type, status, priority, attempts, max_attempts, 
                error_message, source, created_at, next_retry_at,
                payload->>'title' as title
         FROM task_queue
         WHERE status IN ('pending', 'processing')
         ORDER BY priority DESC, created_at ASC
         LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            logger.error('Failed to get pending tasks', { error: error.message });
            return [];
        }
    }

    /**
     * Retry a failed task
     */
    async retryTask(taskId) {
        try {
            await db.query(
                `UPDATE task_queue
         SET status = 'pending', attempts = 0, error_message = NULL, next_retry_at = NOW()
         WHERE id = $1 AND status = 'failed'`,
                [taskId]
            );
            logger.info('Task queued for retry', { taskId });
            return true;
        } catch (error) {
            logger.error('Failed to retry task', { error: error.message, taskId });
            return false;
        }
    }

    /**
     * Cancel a pending task
     */
    async cancelTask(taskId) {
        try {
            await db.query(
                `UPDATE task_queue
         SET status = 'cancelled', completed_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
                [taskId]
            );
            logger.info('Task cancelled', { taskId });
            return true;
        } catch (error) {
            logger.error('Failed to cancel task', { error: error.message, taskId });
            return false;
        }
    }
}

// Singleton instance
const queueService = new QueueService();

module.exports = queueService;
