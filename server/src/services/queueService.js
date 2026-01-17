/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const classificationPhaseService = require('./classificationPhaseService');

const logger = createLogger('QueueService');

// Configuration
const POLL_INTERVAL_MS = 1000;  // Check queue every 1 second when idle
const MAX_CONCURRENT = 5;       // Process up to 5 tasks concurrently
const RETRY_DELAYS = [30, 60, 120, 300, 600]; // Seconds: 30s, 1m, 2m, 5m, 10m

class QueueService {
    constructor() {
        this.running = false;
        this.processing = 0;
        this.aiAvailable = true;
        this.omdbLimitHit = false; // Track if OMDb limit hit to prevent log spam
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
                 SET status = 'failed', error_message = $2, attempts = $3
                 WHERE id = $1`,
                        [taskId, errorMessage, nextAttempt]
                );
                logger.error('Task permanently failed', { taskId, attempts: nextAttempt });
            } else {
                // Schedule retry with exponential backoff
                const delaySeconds = RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)];
                await db.query(
                        `UPDATE task_queue
                 SET status = 'pending', error_message = $2, attempts = $3, next_retry_at = NOW() + INTERVAL '${delaySeconds} seconds'
                 WHERE id = $1`,
                        [taskId, errorMessage, delaySeconds]
                );
                logger.warn('Task scheduled for retry', { taskId, attempt: nextAttempt, delaySeconds });
            }
        } catch (error) {
            logger.error('Failed to update task status', { error: error.message, taskId });
        }
    }

    /**
     * Check if AI is available (respects configured provider)
     */
    async checkAIAvailability() {
        try {
            // Get the configured AI provider
            const provider = await aiRouterService.getProvider('classification');

            // No provider configured or AI disabled
            if (!provider) {
                if (this.aiAvailable) {
                        logger.info('AI is disabled or no provider configured');
                }
                this.aiAvailable = false;
                return false;
            }

            // Cloud provider (OpenAI, Gemini, etc.) - assume available if configured
            if (provider.isCloud) {
                if (!this.aiAvailable) {
                        logger.info(`Cloud AI provider available: ${provider.type}`);
                }
                this.aiAvailable = true;
                return true;
            }

            // Ollama provider - need to check connection
            if (provider.type === 'ollama') {
                const result = await ollamaService.testConnection();

                if (result.success) {
                        if (!this.aiAvailable) {
                                logger.info('Ollama is now available');
                        }
                        this.aiAvailable = true;
                } else {
                        logger.warn('Ollama offline', { error: result.error });
                }
                return result.success;
            }

            // Unknown provider type
            logger.warn('Unknown AI provider type', { type: provider.type });
            return false;
        } catch (error) {
            if (this.aiAvailable) {
                logger.warn('AI availability check failed', { error: error.message });
            }
            this.aiAvailable = false;
            return false;
        }
    }

    /**
     * Process rating normalization for a media item
     */
    async processRatingNormalization(task) {
        const ratingNormalizer = require('../utils/ratingNormalizer');
        const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
        const { media_item_id } = payload;

        try {
            const item = await db.query(
                `SELECT id, content_rating, metadata FROM media_server_items WHERE id = $1`,
                [media_item_id]
            );

            if (item.rows.length === 0) {
                await this.completeTask(task.id, { skipped: true, reason: 'Item not found' });
                return;
            }

            const originalRating = item.rows[0].content_rating;
            const normalizedRating = ratingNormalizer.getPriorityRating(originalRating);

            if (normalizedRating !== originalRating) {
                await db.query(
                        `UPDATE media_server_items
                         SET original_rating = COALESCE(original_rating, $2), content_rating = $3
                         WHERE id = $1`,
                        [media_item_id, normalizedRating]
                );

                logger.info('Rating normalized', {
                    itemId: media_item_id,
                    original: originalRating,
                    normalized: normalizedRating
                });
            }

            await this.completeTask(task.id, {
                normalized: true,
                original: originalRating,
                new: normalizedRating
            });
        } catch (error) {
            logger.error('Rating normalization failed', {
                    itemId: media_item_id,
                    error: error.message
            });
            throw error;
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
                    const result = await classificationService.classify(payload, task.id);
                    
                    // Update task payload with result
                    await db.query(
                            `UPDATE task_queue SET payload = $2 WHERE id = $1`,
                            [task.id, JSON.stringify({ result })]
                    );

                    if (result.success) {
                        await this.completeTask(task.id, result);
                    } else {
                        await this.failTask(task.id, result.error || 'Classification failed', task.attempts || 1, task.maxAttempts || 5);
                    }
                    break;

                case 'metadata_enrichment':
                    // Metadata enrichment is for items ALREADY in Plex libraries
                    // This is LEARNING data - we add content_analysis AND Tavily enrichment
                    // Skip progress tracking for source_library items
                    const result = await classificationService.classify(payload, task.id);
                    
                    // Update task payload with result
                    await db.query(
                            `UPDATE task_queue SET payload = $2 WHERE id = $1`,
                            [task.id, JSON.stringify({ result })]
                    );

                    await this.completeTask(task.id, result);
                    break;

                default:
                    logger.warn('Unknown task type', { taskType: task.task_type });
                    await this.failTask(task.id, 'Unknown task type');
                    break;
            }
        } catch (error) {
            logger.error('Task processing error', { taskId, error: error.message });
            await this.failTask(task.id, error.message, task.attempts || 1, task.maxAttempts || 5);
        }
    }

    /**
     * Resume in-progress tasks after server restart
     */
    async resumeInProgressTasks() {
        // Get all tasks that are currently processing
        const inProgress = await db.query(
                `SELECT id, current_phase FROM task_queue WHERE status = 'processing' AND current_phase IS NOT NULL`
        );

        if (inProgress.rows.length === 0) {
            logger.info('No in-progress tasks to resume');
            return;
        }

        // Resume each task from its stored phase
        for (const task of inProgress.rows) {
            const phaseToResume = await classificationPhaseService.resumeFromPhase(task.id);
            
            if (phaseToResume) {
                logger.info('Resuming task from phase', { taskId, phase: phaseToResume });
            } else {
                logger.warn('Task has no phase to resume from', { taskId });
            }
        }

        logger.info(`Resumed ${inProgress.rows.length} in-progress tasks`);
    }
}
