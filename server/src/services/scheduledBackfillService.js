/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const embeddingService = require('./embeddingService');
const { createLogger } = require('../utils/logger');
const { parseDaysConfig } = require('../utils/backfillHelpers');

const logger = createLogger('ScheduledBackfillService');

/**
 * ScheduledBackfillService
 * Handles scheduled batch processing of embeddings
 */
class ScheduledBackfillService {
    constructor() {
        this.schedule = {
            enabled: false,
            time: '02:00',
            days: [0, 1, 2, 3, 4, 5, 6],
            batchSize: 100,
            maxDuration: 3600000 // 1 hour
        };
        this.schedulerInterval = null;
        this.isRunning = false;
        this.lastCheckTime = null;
    }

    /**
     * Load schedule configuration from database
     */
    async loadScheduleConfig() {
        try {
            const result = await db.query(`
                SELECT 
                    rag_enabled,
                    scheduled_backfill_enabled,
                    scheduled_backfill_time,
                    scheduled_backfill_days,
                    scheduled_backfill_batch_size,
                    scheduled_backfill_max_duration
                FROM ai_provider_config 
                WHERE id = 1
            `);

            if (result.rows.length > 0) {
                const row = result.rows[0];
                this.schedule = {
                    ragEnabled: row.rag_enabled || false,
                    enabled: row.scheduled_backfill_enabled || false,
                    time: row.scheduled_backfill_time || '02:00',
                    days: parseDaysConfig(row.scheduled_backfill_days),
                    batchSize: row.scheduled_backfill_batch_size || 100,
                    maxDuration: row.scheduled_backfill_max_duration || 3600000
                };
            }

            return this.schedule;
        } catch (error) {
            logger.error('Failed to load schedule config', { error: error.message });
            return this.schedule;
        }
    }

    /**
     * Initialize scheduler
     */
    async initScheduler() {
        await this.loadScheduleConfig();

        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
        }

        logger.info('Initializing scheduled backfill', { schedule: this.schedule });

        // Check every minute if it's time to run
        this.schedulerInterval = setInterval(() => {
            this.checkSchedule();
        }, 60000);
    }

    /**
     * Check if it's time to run scheduled backfill
     */
    async checkSchedule() {
        if (!this.schedule.enabled) {
            return;
        }

        if (this.isRunning) {
            return;
        }

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentDay = now.getDay();

        // Prevent running multiple times in the same minute
        if (this.lastCheckTime === currentTime) {
            return;
        }

        if (currentTime === this.schedule.time && this.schedule.days.includes(currentDay)) {
            this.lastCheckTime = currentTime;
            logger.info('Triggering scheduled backfill', { time: currentTime, day: currentDay });
            await this.runScheduledBackfill();
        }
    }

    /**
     * Get pending embeddings
     */
    async getPendingEmbeddings(limit) {
        try {
            const result = await db.query(`
                SELECT ch.id, ch.title, ch.media_type, ch.library_name, ch.metadata
                FROM classification_history ch
                WHERE NOT EXISTS (
                    SELECT 1 FROM classification_embeddings ce
                    WHERE ce.classification_id = ch.id
                )
                ORDER BY ch.created_at DESC
                LIMIT $1
            `, [limit]);

            return result.rows.map(row => ({
                id: row.id,
                title: row.title,
                media_type: row.media_type,
                library_name: row.library_name,
                metadata: typeof row.metadata === 'string'
                    ? JSON.parse(row.metadata)
                    : row.metadata
            }));
        } catch (error) {
            logger.error('Failed to get pending embeddings', { error: error.message });
            return [];
        }
    }

    /**
     * Run scheduled backfill
     */
    async runScheduledBackfill() {
        // Reload config to get latest rag_enabled status
        await this.loadScheduleConfig();

        // Check if RAG is enabled
        if (!this.schedule.ragEnabled) {
            logger.debug('RAG is not enabled, skipping scheduled backfill');
            return;
        }

        if (this.isRunning) {
            logger.warn('Scheduled backfill already running');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        let processed = 0;

        logger.info('Starting scheduled backfill', {
            batchSize: this.schedule.batchSize,
            maxDuration: this.schedule.maxDuration
        });

        // Create run record
        const runResult = await db.query(`
            INSERT INTO backfill_runs (type, status)
            VALUES ('scheduled', 'running')
            RETURNING id
        `);
        const runId = runResult.rows[0].id;

        try {
            while (Date.now() - startTime < this.schedule.maxDuration) {
                const pending = await this.getPendingEmbeddings(this.schedule.batchSize);

                if (pending.length === 0) {
                    logger.info('No more pending embeddings');
                    break;
                }

                for (const item of pending) {
                    if (Date.now() - startTime >= this.schedule.maxDuration) {
                        logger.info('Max duration reached, stopping scheduled backfill');
                        break;
                    }

                    try {
                        await embeddingService.generateAndStore(item.id, {
                            ...item.metadata,
                            title: item.title,
                            media_type: item.media_type,
                            library_name: item.library_name
                        });
                        processed++;

                        // Update progress every 10 items
                        if (processed % 10 === 0) {
                            await db.query(
                                'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
                                [processed, runId]
                            );
                        }
                    } catch (error) {
                        logger.error('Failed to generate embedding in scheduled backfill', {
                            id: item.id,
                            title: item.title,
                            error: error.message
                        });
                    }
                }
            }

            const duration = Date.now() - startTime;

            await db.query(`
                UPDATE backfill_runs 
                SET status = 'completed', 
                    completed_at = NOW(),
                    processed = $1
                WHERE id = $2
            `, [processed, runId]);

            logger.info('Scheduled backfill completed', {
                processed,
                durationMs: duration
            });
        } catch (error) {
            logger.error('Scheduled backfill error', { error: error.message });

            await db.query(`
                UPDATE backfill_runs 
                SET status = 'failed', 
                    completed_at = NOW(),
                    error = $1,
                    processed = $2
                WHERE id = $3
            `, [error.message, processed, runId]);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Update schedule configuration
     */
    updateSchedule(newSchedule) {
        this.schedule = { ...this.schedule, ...newSchedule };
        logger.info('Schedule updated', { schedule: this.schedule });
    }

    /**
     * Get current schedule
     */
    getSchedule() {
        return this.schedule;
    }

    /**
     * Stop scheduler
     */
    stop() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
            logger.info('Scheduled backfill stopped');
        }
    }
}

module.exports = new ScheduledBackfillService();
