/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const db = require('../config/database');
const { createLogger } = require('./logger');
const {
    categorizeError,
    mapSecondPassError,
    normalizeReasonCode,
    normalizeSecondPassStage
} = require('./ragErrorHandler');

const logger = createLogger('RAGLogger');

const DEDUPE_DEFAULT_WINDOW_MS = 30000;
const DEDUPE_CACHE_MAX_ENTRIES = 1000;
const DEDUPE_CACHE_PRUNE_INTERVAL = 100;
const VALID_LEVELS = new Set(['INFO', 'WARN', 'ERROR']);
const SECOND_PASS_SKIP_BY_DESIGN_REASONS = new Set([
    'feature_disabled',
    'gate_not_met',
    'trigger_not_policy',
    'policy_context_missing',
    'missing_tmdb_id',
    'missing_media_type',
    'insufficient_high_impact_metadata',
    'no_verifiable_evidence',
    'non_authoritative_identifiers_rejected',
    'policy_candidate_selected',
    'metadata_complete',
    'ai_temporarily_unavailable',
    'enrichment_disabled',
    'attempt_cap_reached',
    'loop_budget_exhausted',
    'resilience_closed',
    'material_improvement_not_met',
    'manual_confirmation_required',
    'machine_only_blocked'
]);

/**
 * RAG Logger Utility
 * Specialized logging for RAG operations and second-pass observability.
 */
class RAGLogger {
    constructor() {
        this.fingerprintCache = new Map();
        this.writeCount = 0;
    }

    normalizeLevel(level, fallback = 'INFO') {
        const value = typeof level === 'string' ? level.toUpperCase() : '';
        if (VALID_LEVELS.has(value)) {
            return value;
        }
        return fallback;
    }

    normalizeSqlState(sqlState) {
        const raw = typeof sqlState === 'string' ? sqlState.trim().toUpperCase() : '';
        if (!raw) {
            return null;
        }
        return /^[A-Z0-9]{1,10}$/.test(raw) ? raw : null;
    }

    normalizeFallbackAction(value) {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '');

        return normalized || null;
    }

    shouldPruneFingerprintCache() {
        this.writeCount += 1;
        return (
            this.writeCount % DEDUPE_CACHE_PRUNE_INTERVAL === 0 ||
            this.fingerprintCache.size > DEDUPE_CACHE_MAX_ENTRIES
        );
    }

    pruneFingerprintCache(now = Date.now()) {
        const maxAge = DEDUPE_DEFAULT_WINDOW_MS * 4;
        for (const [fingerprint, seenAt] of this.fingerprintCache.entries()) {
            if ((now - seenAt) > maxAge) {
                this.fingerprintCache.delete(fingerprint);
            }
        }
    }

    buildFingerprint({
        module = 'RAG',
        stage = null,
        reasonCode = null,
        sqlState = null
    } = {}) {
        return [
            module || 'RAG',
            stage || 'none',
            reasonCode || 'none',
            sqlState || 'none'
        ].join('|');
    }

    shouldThrottleFingerprint(fingerprint, level, dedupeWindowMs = DEDUPE_DEFAULT_WINDOW_MS) {
        const normalizedLevel = this.normalizeLevel(level, 'INFO');
        if (normalizedLevel === 'INFO') {
            return false;
        }

        const now = Date.now();
        const previous = this.fingerprintCache.get(fingerprint);
        if (previous && (now - previous) < dedupeWindowMs) {
            return true;
        }

        this.fingerprintCache.set(fingerprint, now);
        if (this.shouldPruneFingerprintCache()) {
            this.pruneFingerprintCache(now);
        }

        return false;
    }

    resolveStageSeverity({
        outcome = null,
        reasonCode = null,
        fallbackAction = null,
        recoverable = true,
        error = null
    } = {}) {
        const normalizedOutcome = typeof outcome === 'string' ? outcome.trim().toLowerCase() : '';
        const normalizedReason = normalizeReasonCode(reasonCode);
        const hasFallbackAction = !!this.normalizeFallbackAction(fallbackAction);
        const hasError = !!error;
        const isSkipByDesign = (
            normalizedOutcome === 'skipped' &&
            SECOND_PASS_SKIP_BY_DESIGN_REASONS.has(normalizedReason)
        );

        if (isSkipByDesign) {
            return 'INFO';
        }

        if (recoverable === false) {
            return 'ERROR';
        }

        if (normalizedOutcome === 'error' || normalizedOutcome === 'retry') {
            return 'WARN';
        }

        if (hasFallbackAction || hasError) {
            return 'WARN';
        }

        return 'INFO';
    }

    buildStageLogContract(event = {}) {
        const stage = normalizeSecondPassStage(event.stage);
        const mapped = mapSecondPassError({
            stage,
            reasonCode: event.reason_code || event.reasonCode,
            fallbackReasonCode: event.fallbackReasonCode,
            error: event.error
        });
        const reasonCode = normalizeReasonCode(event.reason_code || event.reasonCode || mapped.reasonCode);
        const sqlState = this.normalizeSqlState(event.sql_state || event.sqlState || mapped.sqlState);
        const recoverable = typeof event.recoverable === 'boolean'
            ? event.recoverable
            : mapped.recoverable;
        const fallbackAction = this.normalizeFallbackAction(event.fallback_action || event.fallbackAction);
        const level = this.normalizeLevel(
            event.level,
            this.resolveStageSeverity({
                outcome: event.outcome,
                reasonCode,
                fallbackAction,
                recoverable,
                error: event.error
            })
        );
        const message = typeof event.message === 'string' && event.message.trim()
            ? event.message.trim()
            : `Second-pass stage ${stage || 'unknown'} ${event.outcome || 'event'} (${reasonCode || 'unspecified'})`;

        return {
            level,
            module: 'RAG',
            message,
            stackTrace: event.error?.stack || null,
            metadata: {
                event_type: 'rag_second_pass_stage',
                stage,
                outcome: event.outcome || null,
                reason_code: reasonCode,
                rollout_mode: event.rollout_mode || event.rolloutMode || null,
                strategy: event.strategy || null,
                fallback_action: fallbackAction,
                recoverable,
                trigger: event.trigger || null,
                dedupe_fingerprint: this.buildFingerprint({
                    module: 'RAG',
                    stage,
                    reasonCode,
                    sqlState
                }),
                ...event.metadata
            },
            ragOperation: event.rag_operation || event.ragOperation || 'second_pass',
            ragContext: {
                stage,
                outcome: event.outcome || null,
                reason_code: reasonCode,
                fallback_action: fallbackAction,
                trigger: event.trigger || null,
                strategy: event.strategy || null
            },
            durationMs: Number.isFinite(Number(event.duration_ms || event.durationMs))
                ? Number(event.duration_ms || event.durationMs)
                : null,
            recoverable,
            classificationId: Number.isInteger(event.classification_id)
                ? event.classification_id
                : (Number.isInteger(event.classificationId) ? event.classificationId : null),
            errorStage: stage,
            reasonCode,
            correlationId: event.correlation_id || event.correlationId || null,
            sqlState,
            dedupeWindowMs: Number.isFinite(Number(event.dedupe_window_ms || event.dedupeWindowMs))
                ? Number(event.dedupe_window_ms || event.dedupeWindowMs)
                : DEDUPE_DEFAULT_WINDOW_MS
        };
    }

    isSchemaCompatibilityError(error) {
        const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
        const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
        return (
            code.startsWith('42') ||
            message.includes('column') && message.includes('does not exist') ||
            message.includes('relation') && message.includes('does not exist')
        );
    }

    async insertErrorLog(payload) {
        const params = [
            payload.level,
            payload.module,
            payload.message,
            payload.stackTrace,
            JSON.stringify(payload.metadata || {}),
            payload.ragOperation,
            JSON.stringify(payload.ragContext || {}),
            payload.durationMs,
            payload.recoverable,
            payload.classificationId,
            payload.errorStage,
            payload.reasonCode,
            payload.correlationId,
            payload.sqlState
        ];

        try {
            await db.query(`
                INSERT INTO error_log 
                (level, module, message, stack_trace, metadata, rag_operation, rag_context, duration_ms, recoverable, classification_id, error_stage, reason_code, correlation_id, sql_state)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, params);
            return true;
        } catch (error) {
            if (!this.isSchemaCompatibilityError(error)) {
                throw error;
            }

            await db.query(`
                INSERT INTO error_log 
                (level, module, message, stack_trace, metadata, rag_operation, rag_context, duration_ms, recoverable)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, params.slice(0, 9));
            return true;
        }
    }

    /**
     * Log a second-pass stage event using the structured Issue 275 contract.
     * @param {object} event - Stage event payload
     * @returns {Promise<{logged: boolean, deduped: boolean}>}
     */
    async logStageEvent(event = {}) {
        try {
            const payload = this.buildStageLogContract(event);
            const fingerprint = payload.metadata?.dedupe_fingerprint || this.buildFingerprint({
                module: payload.module,
                stage: payload.errorStage,
                reasonCode: payload.reasonCode,
                sqlState: payload.sqlState
            });
            const deduped = this.shouldThrottleFingerprint(
                fingerprint,
                payload.level,
                payload.dedupeWindowMs
            );
            if (deduped) {
                return { logged: false, deduped: true };
            }

            await this.insertErrorLog(payload);
            const line = {
                stage: payload.errorStage,
                reasonCode: payload.reasonCode,
                sqlState: payload.sqlState,
                classificationId: payload.classificationId,
                correlationId: payload.correlationId
            };
            if (payload.level === 'ERROR') {
                logger.error(payload.message, line, { skipDbPersist: true });
            } else if (payload.level === 'WARN') {
                logger.warn(payload.message, line, { skipDbPersist: true });
            } else {
                logger.info(payload.message, line);
            }

            return { logged: true, deduped: false };
        } catch (error) {
            logger.warn('Failed to log second-pass stage event', {
                error: error.message,
                stage: event.stage || null,
                reason_code: event.reason_code || event.reasonCode || null
            });
            return { logged: false, deduped: false };
        }
    }

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
        } catch (error) {
            logger.warn('Failed to log RAG operation', {
                operation,
                error: error.message
            });
        }
    }

    /**
     * Log a RAG error with context.
     * @param {Error} error - Error that occurred
     * @param {string} operation - RAG operation that failed
     * @param {object} context - Additional context
     */
    async logError(error, operation, context = {}) {
        try {
            const hasStage = !!normalizeSecondPassStage(context.stage || context.error_stage);
            if (hasStage) {
                return this.logStageEvent({
                    ...context,
                    stage: context.stage || context.error_stage,
                    reason_code: context.reason_code || context.reasonCode,
                    fallback_action: context.fallback_action || context.fallbackAction,
                    sql_state: context.sql_state || context.sqlState,
                    rag_operation: operation,
                    message: error?.message,
                    error
                });
            }

            const errorType = categorizeError(error || {});
            const recoverable = error?.recoverable !== undefined ? error.recoverable : true;
            const durationMs = context.duration_ms || context.durationMs || error?.context?.duration_ms || null;

            await this.insertErrorLog({
                level: 'ERROR',
                module: 'RAG',
                message: error?.message || 'Unknown RAG error',
                stackTrace: error?.stack || null,
                metadata: {
                    errorType,
                    ...context
                },
                ragOperation: operation,
                ragContext: error?.context || context,
                durationMs,
                recoverable,
                classificationId: Number.isInteger(context.classification_id) ? context.classification_id : null,
                errorStage: null,
                reasonCode: null,
                correlationId: null,
                sqlState: this.normalizeSqlState(context.sql_state || context.sqlState || error?.code)
            });

            logger.error('RAG error logged', {
                operation,
                errorType,
                message: error?.message
            });
            return { logged: true, deduped: false };
        } catch (logError) {
            logger.warn('Failed to log RAG error', {
                error: logError.message
            });
            return { logged: false, deduped: false };
        }
    }

    /**
     * Get RAG health summary.
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
            const operations24h = parseInt(row.operations_24h, 10) || 0;
            return {
                operations_24h: operations24h,
                operations_1h: parseInt(row.operations_1h, 10) || 0,
                successful_24h: parseInt(row.successful_24h, 10) || 0,
                failed_24h: parseInt(row.failed_24h, 10) || 0,
                success_rate_24h: operations24h > 0
                    ? Math.round((parseInt(row.successful_24h, 10) / operations24h) * 100) / 100
                    : 0,
                avg_duration_ms_24h: Math.round(parseFloat(row.avg_duration_ms_24h) || 0),
                semantic_searches_24h: parseInt(row.semantic_searches_24h, 10) || 0,
                hybrid_searches_24h: parseInt(row.hybrid_searches_24h, 10) || 0,
                embeddings_generated_24h: parseInt(row.embeddings_generated_24h, 10) || 0,
                pattern_mining_runs_24h: parseInt(row.pattern_mining_runs_24h, 10) || 0
            };
        } catch (error) {
            logger.error('Failed to get health summary', { error: error.message });
            return null;
        }
    }

    /**
     * Get recent RAG errors.
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
                    classification_id,
                    error_stage,
                    reason_code,
                    correlation_id,
                    sql_state,
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

            return result.rows.map((row) => ({
                id: row.id,
                errorId: row.error_id,
                level: row.level,
                message: row.message,
                operation: row.rag_operation,
                context: row.rag_context,
                durationMs: row.duration_ms,
                recoverable: row.recoverable,
                classificationId: row.classification_id,
                stage: row.error_stage,
                reasonCode: row.reason_code,
                correlationId: row.correlation_id,
                sqlState: row.sql_state,
                createdAt: row.created_at
            }));
        } catch (error) {
            logger.error('Failed to get recent errors', { error: error.message });
            return [];
        }
    }

    /**
     * Get metrics by operation type.
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
                totalOps: parseInt(row.total_ops, 10) || 0,
                successful: parseInt(row.successful, 10) || 0,
                failed: parseInt(row.failed, 10) || 0,
                successRate: row.total_ops > 0
                    ? Math.round((row.successful / row.total_ops) * 100) / 100
                    : 0,
                avgDuration: Math.round(parseFloat(row.avg_duration) || 0),
                minDuration: Math.round(parseFloat(row.min_duration) || 0),
                maxDuration: Math.round(parseFloat(row.max_duration) || 0),
                totalItems: parseInt(row.total_items, 10) || 0
            };
        } catch (error) {
            logger.error('Failed to get metrics by operation', { error: error.message });
            return null;
        }
    }
}

module.exports = new RAGLogger();
module.exports.RAGLogger = RAGLogger;
