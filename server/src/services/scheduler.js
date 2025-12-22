/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 * 
 * Scheduler Service
 * Handles periodic background tasks
 */

const cron = require('node-cron');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const queueService = require('./queueService');

const logger = createLogger('SchedulerService');

class SchedulerService {
    constructor() {
        this.tasks = new Map();
    }

    /**
     * Initialize scheduled tasks
     */
    init() {
        logger.info('Initializing scheduler...');

        // Run gap analysis every hour
        // This finds items that haven't been analyzed and queues them
        this.schedule('gap-analysis', '0 * * * *', () => this.runGapAnalysis());

        // Also run on startup after a delay
        setTimeout(() => this.runGapAnalysis(), 30000); // 30s delay

        // Cleanup old sessions every hour 
        // this.schedule('session-cleanup', '0 * * * *', ...);
    }

    /**
     * Schedule a task
     * @param {string} name - Task name
     * @param {string} cronExpression - Cron expression
     * @param {Function} handler - Task handler
     */
    schedule(name, cronExpression, handler) {
        if (this.tasks.has(name)) {
            this.tasks.get(name).stop();
        }

        const task = cron.schedule(cronExpression, async () => {
            logger.info(`Starting scheduled task: ${name}`);
            try {
                await handler();
                logger.info(`Completed scheduled task: ${name}`);
            } catch (error) {
                logger.error(`Failed scheduled task: ${name}`, { error: error.message });
            }
        });

        this.tasks.set(name, task);
        logger.info(`Scheduled task registered: ${name} (${cronExpression})`);
    }

    /**
     * Run Gap Analysis specifically
     */
    async runGapAnalysis() {
        try {
            // Find items that have NO content analysis
            // Limit to 100 at a time to prevent flooding the queue
            const result = await db.query(
                `SELECT id, title, metadata, genres, tags, content_rating, tmdb_id 
         FROM media_server_items 
         WHERE metadata->'content_analysis' IS NULL
         LIMIT 100`
            );

            if (result.rows.length === 0) {
                logger.debug('Gap analysis: No unanalyzed items found');
                return;
            }

            logger.info(`Gap analysis: Found ${result.rows.length} unanalyzed items. Queueing for analysis...`);

            for (const item of result.rows) {
                await queueService.enqueue('classification', {
                    title: item.title,
                    overview: item.metadata?.summary || '',
                    genres: typeof item.genres === 'string' ? JSON.parse(item.genres) : (item.genres || []),
                    keywords: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
                    content_rating: item.content_rating,
                    original_language: 'en',
                    tmdb_id: item.tmdb_id,
                    itemId: item.id // Pass internal ID for efficient updating
                }, {
                    priority: 5, // Lower priority than user actions
                    source: 'gap_analysis'
                });
            }

        } catch (error) {
            logger.error('Error running gap analysis', { error: error.message });
        }
    }
}

module.exports = new SchedulerService();
