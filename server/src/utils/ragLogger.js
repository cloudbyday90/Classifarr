/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const { createLogger } = require('./logger');
const { categorizeError } = require('./ragErrorHandler');

const logger = createLogger('RAGLogger');

/**
 * RAG Logger Utility
 * Specialized logging for RAG operations with metrics tracking
 */
class RAGLogger {
    /**
     * Log a RAG operation with metrics
     * @param {string} operation - Operation type (semantic_search, hybrid_search, etc.)
     * @param {number} durationMs - Duration in milliseconds
     * @param {boolean} success - Whether operation succeeded
     * @param {object} options - Additional options
     */
    async logOperation(operation, durationMs, success = true, options = {}) {
        try {
            const {
                itemsProcessed = 1,
                errorType = null,
                metadata = {},
                periodType = 'hourly'
            } = options;

            // Calculate period start based on period type
            const now = new Date();
            let periodStart;
            
            if (periodType === 'hourly') {
                periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
            } else if (periodType === 'daily') {
                periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            } else {
                periodStart = now;
            }

            await db.query(`
                INSERT INTO rag_metrics 
                (operation, duration_ms, items_processed, success, error_type, metadata, period_type, period_start)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                operation,
                durationMs,
                itemsProcessed,
                success,
                errorType,
                JSON.stringify(metadata),
                periodType,
                periodStart
            ]);

            logger.debug('RAG operation logged', {
                operation,
                durationMs,
                success,
                itemsProcessed
            });
        } catch (error) {
            // Don't throw - logging failures shouldn't break operations
            logger.warn('Failed to log RAG operation', {
                operation,
                error: error.message
            });
        }
    }

    /**
     * Log a RAG error with context
     * @param {Error} error - Error that occurred
     * @param {string} operation - RAG operation that failed
     * @param {object} context - Additional context
     */
    async logError(error, operation, context = {}) {
        try {
            const errorType = categorizeError(error);
            const recoverable = error.recoverable !== undefined ? error.recoverable : true;
            const durationMs = context.duration_ms || error.context?.duration_ms || null;

            await db.query(`
                INSERT INTO error_log 
                (level, module, message, stack_trace, metadata, rag_operation, rag_context, duration_ms, recoverable)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                'ERROR',
                'RAG',
                error.message,
                error.stack,
                JSON.stringify({
                    errorType,
                    ...context
                }),
                operation,
                JSON.stringify(error.context || context),
                durationMs,
                recoverable
            ]);

            logger.error('RAG error logged', {
                operation,
                errorType,
                message: error.message
            });
        } catch (logError) {
            logger.warn('Failed to log RAG error', {
                error: logError.message
            });
        }
    }

    /**
     * Get RAG health summary
     * @returns {Promise<object>} Health summary data
     */
    async getHealthSummary() {
        try {
            const result = await db.query('SELECT * FROM rag_health_summary');
            
            if (result.rows.length === 0) {
                return {
                    operations_24h: 0,
                    operations_1h: 0,
                    successful_24h: 0,
                    failed_24h: 0,
                    avg_duration_ms_24h: 0,
                    semantic_searches_24h: 0,
                    hybrid_searches_24h: 0,
                    embeddings_generated_24h: 0,
                    pattern_mining_runs_24h: 0
                };
            }

            const row = result.rows[0];
            const operations24h = parseInt(row.operations_24h) || 0;
            return {
                operations_24h: operations24h,
                operations_1h: parseInt(row.operations_1h) || 0,
                successful_24h: parseInt(row.successful_24h) || 0,
                failed_24h: parseInt(row.failed_24h) || 0,
                success_rate_24h: operations24h > 0 
                    ? Math.round((parseInt(row.successful_24h) / operations24h) * 100) / 100
                    : 0,
                avg_duration_ms_24h: Math.round(parseFloat(row.avg_duration_ms_24h) || 0),
                semantic_searches_24h: parseInt(row.semantic_searches_24h) || 0,
                hybrid_searches_24h: parseInt(row.hybrid_searches_24h) || 0,
                embeddings_generated_24h: parseInt(row.embeddings_generated_24h) || 0,
                pattern_mining_runs_24h: parseInt(row.pattern_mining_runs_24h) || 0
            };
        } catch (error) {
            logger.error('Failed to get health summary', { error: error.message });
            return null;
        }
    }

    /**
     * Get recent RAG errors
     * @param {number} limit - Max errors to return
     * @param {string} operation - Optional filter by operation
     * @returns {Promise<Array>} Recent errors
     */
    async getRecentErrors(limit = 50, operation = null) {
        try {
            let query = `
                SELECT 
                    id,
                    error_id,
                    level,
                    message,
                    rag_operation,
                    rag_context,
                    duration_ms,
                    recoverable,
                    created_at
                FROM error_log
                WHERE rag_operation IS NOT NULL
            `;
            const params = [];

            if (operation) {
                query += ' AND rag_operation = $1';
                params.push(operation);
                query += ' ORDER BY created_at DESC LIMIT $2';
                params.push(limit);
            } else {
                query += ' ORDER BY created_at DESC LIMIT $1';
                params.push(limit);
            }

            const result = await db.query(query, params);
            
            return result.rows.map(row => ({
                id: row.id,
                errorId: row.error_id,
                level: row.level,
                message: row.message,
                operation: row.rag_operation,
                context: row.rag_context,
                durationMs: row.duration_ms,
                recoverable: row.recoverable,
                createdAt: row.created_at
            }));
        } catch (error) {
            logger.error('Failed to get recent errors', { error: error.message });
            return [];
        }
    }

    /**
     * Get metrics by operation type
     * @param {string} operation - Operation type
     * @param {number} hours - Hours to look back (default 24)
     * @returns {Promise<object>} Metrics summary
     */
    async getMetricsByOperation(operation, hours = 24) {
        try {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total_ops,
                    COUNT(*) FILTER (WHERE success = true) as successful,
                    COUNT(*) FILTER (WHERE success = false) as failed,
                    AVG(duration_ms) as avg_duration,
                    MIN(duration_ms) as min_duration,
                    MAX(duration_ms) as max_duration,
                    SUM(items_processed) as total_items
                FROM rag_metrics
                WHERE operation = $1
                AND created_at >= NOW() - INTERVAL '${hours} hours'
            `, [operation]);

            const row = result.rows[0];
            return {
                operation,
                totalOps: parseInt(row.total_ops) || 0,
                successful: parseInt(row.successful) || 0,
                failed: parseInt(row.failed) || 0,
                successRate: row.total_ops > 0 
                    ? Math.round((row.successful / row.total_ops) * 100) / 100
                    : 0,
                avgDuration: Math.round(parseFloat(row.avg_duration) || 0),
                minDuration: Math.round(parseFloat(row.min_duration) || 0),
                maxDuration: Math.round(parseFloat(row.max_duration) || 0),
                totalItems: parseInt(row.total_items) || 0
            };
        } catch (error) {
            logger.error('Failed to get metrics by operation', { error: error.message });
            return null;
        }
    }
}

module.exports = new RAGLogger();
