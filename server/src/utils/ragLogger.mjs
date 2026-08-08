/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from './logger.mjs';
import * as ragErrorHandler from './ragErrorHandler.mjs';

const logger = createLogger('RAGLogger');

const DEDUPE_DEFAULT_WINDOW_MS = 30000;
const DEDUPE_CACHE_MAX_ENTRIES = 1000;
const DEDUPE_CACHE_PRUNE_INTERVAL = 100;
const VALID_LEVELS = new Set(['INFO', 'WARN', 'ERROR']);
const BOUNDED_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,119}$/i;
const BOUNDED_METRIC_STRING_FIELDS = new Set([
    'stage',
    'outcome',
    'reason_code',
    'sql_state',
    'rollout_mode',
    'strategy',
    'trigger',
    'fusionMethod',
]);
const BOUNDED_METRIC_NUMBER_FIELDS = new Set([
    'duration_ms',
    'semanticMatches',
    'textMatches',
    'graphMatches',
    'fusedResults',
    'expansionTermCount',
]);
const BOUNDED_METRIC_BOOLEAN_FIELDS = new Set([
    'recoverable',
    'graphEnabled',
    'expandedQuery',
]);
const SECOND_PASS_SKIP_BY_DESIGN_REASONS = new Set([
    'feature_disabled',
    'gate_not_met',
    'policy_prompt_risk_clear',
    'policy_recheck_resolved',
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
const SECOND_PASS_NOOP_SUPPRESS_REASONS = new Set([
    'policy_prompt_select',
    'policy_prompt_risk_clear',
    'auto_default',
    'low_signal',
    'metadata_complete',
    'policy_not_upgraded',
    'no_material_improvement',
    'material_improvement_not_met',
    'rag_pass1_candidate_failed',
    'rag_pass2_failed'
]);
const SECOND_PASS_NOOP_SUPPRESS_OUTCOMES = new Set([
    'run',
    'strategy_selected',
    'skipped',
    'evaluated',
    'retry'
]);
const SECOND_PASS_RECOVERABLE_SOFT_ERROR_REASONS = new Set([
    'rag_pass1_candidate_failed',
    'rag_pass2_failed'
]);
const RAG_READ_LOG_REASON_IDS = Object.freeze({
    HEALTH_SUMMARY_FAILED: 'rag_health_summary_read_failed',
    RECENT_ERRORS_FAILED: 'rag_recent_errors_read_failed',
    METRICS_BY_OPERATION_FAILED: 'rag_metrics_by_operation_read_failed',
});

export class RAGLogger {
    constructor(deps = {}) {
        this.fingerprintCache = new Map();
        this.writeCount = 0;
        this.ragErrorHandler = deps.ragErrorHandler || ragErrorHandler;
    }

    async getRagErrorHandler() {
        return this.ragErrorHandler;
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
        return /^(?=.*[0-9])[A-Z0-9]{1,10}$/.test(raw) ? raw : null;
    }

    normalizeBoundedIdentifier(value, fallback = null) {
        const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
        return BOUNDED_IDENTIFIER_PATTERN.test(normalized) ? normalized : fallback;
    }

    projectBoundedMetricMetadata(metadata = {}) {
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
            return {};
        }

        const projection = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (BOUNDED_METRIC_STRING_FIELDS.has(key)) {
                const normalized = this.normalizeBoundedIdentifier(value);
                if (normalized) projection[key] = normalized;
            } else if (BOUNDED_METRIC_NUMBER_FIELDS.has(key) && Number.isFinite(Number(value))) {
                projection[key] = Math.max(0, Math.round(Number(value)));
            } else if (BOUNDED_METRIC_BOOLEAN_FIELDS.has(key) && typeof value === 'boolean') {
                projection[key] = value;
            }
        }

        return projection;
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

    async resolveStageSeverity({
        outcome = null,
        reasonCode = null,
        fallbackAction = null,
        recoverable = true,
        error = null
    } = {}) {
        const { normalizeReasonCode } = await this.getRagErrorHandler();
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

        const isSoftRecoverableStageMiss = (
            recoverable !== false &&
            !hasError &&
            (normalizedOutcome === 'error' || normalizedOutcome === 'retry') &&
            SECOND_PASS_RECOVERABLE_SOFT_ERROR_REASONS.has(normalizedReason)
        );

        if (isSoftRecoverableStageMiss) {
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

    async shouldSuppressStageEvent(payload = {}) {
        const { normalizeReasonCode } = await this.getRagErrorHandler();
        const outcome = typeof payload?.metadata?.outcome === 'string'
            ? payload.metadata.outcome.trim().toLowerCase()
            : '';
        const reasonCode = normalizeReasonCode(
            payload?.reasonCode || payload?.metadata?.reason_code
        );

        if (payload.level === 'ERROR' || payload.recoverable === false) {
            return false;
        }

        if (!SECOND_PASS_NOOP_SUPPRESS_REASONS.has(reasonCode)) {
            return false;
        }

        return SECOND_PASS_NOOP_SUPPRESS_OUTCOMES.has(outcome);
    }

    async buildStageLogContract(event = {}) {
        const {
            mapSecondPassError,
            normalizeReasonCode,
            normalizeSecondPassStage
        } = await this.getRagErrorHandler();
        const stage = normalizeSecondPassStage(event.stage);
        const outcome = this.normalizeBoundedIdentifier(event.outcome, 'event');
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
            await this.resolveStageSeverity({
                outcome,
                reasonCode,
                fallbackAction,
                recoverable,
                error: event.error
            })
        );
        const rolloutMode = this.normalizeBoundedIdentifier(event.rollout_mode || event.rolloutMode);
        const strategy = this.normalizeBoundedIdentifier(event.strategy);
        const trigger = this.normalizeBoundedIdentifier(event.trigger);
        const ragOperation = this.normalizeBoundedIdentifier(event.rag_operation || event.ragOperation, 'second_pass');
        const message = `Second-pass stage ${stage || 'unknown'} ${outcome} (${reasonCode || 'unspecified'})`;

        return {
            level,
            module: 'RAG',
            message,
            stackTrace: null,
            metadata: {
                event_type: 'rag_second_pass_stage',
                stage,
                outcome,
                reason_code: reasonCode,
                rollout_mode: rolloutMode,
                strategy,
                fallback_action: fallbackAction,
                recoverable,
                trigger,
                dedupe_fingerprint: this.buildFingerprint({
                    module: 'RAG',
                    stage,
                    reasonCode,
                    sqlState
                }),
                duration_ms: Number.isFinite(Number(event.duration_ms || event.durationMs))
                    ? Math.max(0, Math.round(Number(event.duration_ms || event.durationMs)))
                    : null,
            },
            ragOperation,
            ragContext: {
                stage,
                outcome,
                reason_code: reasonCode,
                fallback_action: fallbackAction,
                trigger,
                strategy,
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

    async logStageEvent(event = {}) {
        try {
            const payload = await this.buildStageLogContract(event);
            if (await this.shouldSuppressStageEvent(payload)) {
                logger.debug('Suppressed non-actionable second-pass stage event', {
                    stage: payload.errorStage,
                    outcome: payload.metadata?.outcome || null,
                    reasonCode: payload.reasonCode,
                    classificationId: payload.classificationId
                });
                return { logged: false, deduped: false, suppressed: true };
            }
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

            const persistToDb = payload.level !== 'INFO';
            if (persistToDb) {
                await this.insertErrorLog(payload);
            }
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
        } catch {
            logger.warn('Failed to log second-pass stage event', {
                stage: this.normalizeBoundedIdentifier(event.stage),
                reason_code: 'rag_stage_log_failed'
            });
            return { logged: false, deduped: false };
        }
    }

    async logOperation(operation, durationMs, success = true, options = {}) {
        const boundedOperation = this.normalizeBoundedIdentifier(operation, 'unknown');
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

            const boundedErrorType = this.normalizeBoundedIdentifier(errorType);
            const boundedMetadata = this.projectBoundedMetricMetadata(metadata);

            await db.query(`
                INSERT INTO rag_metrics 
                (operation, duration_ms, items_processed, success, error_type, metadata, period_type, period_start)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                boundedOperation,
                durationMs,
                itemsProcessed,
                success,
                boundedErrorType,
                JSON.stringify(boundedMetadata),
                periodType,
                periodStart
            ]);
        } catch {
            logger.warn('Failed to log RAG operation', {
                operation: boundedOperation,
                reason_code: 'rag_operation_log_failed'
            });
        }
    }

    async logError(error, operation, context = {}) {
        try {
            const {
                categorizeError,
                normalizeSecondPassStage
            } = await this.getRagErrorHandler();
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
            const boundedOperation = this.normalizeBoundedIdentifier(operation, 'unknown');
            const boundedErrorType = this.normalizeBoundedIdentifier(errorType, 'unknown');

            await this.insertErrorLog({
                level: 'ERROR',
                module: 'RAG',
                message: `RAG operation ${boundedOperation} failed (${boundedErrorType})`,
                stackTrace: null,
                metadata: {
                    event_type: 'rag_operation_failure',
                    error_type: boundedErrorType,
                },
                ragOperation: boundedOperation,
                ragContext: {
                    operation: boundedOperation,
                    error_type: boundedErrorType,
                },
                durationMs,
                recoverable: recoverable === false ? false : true,
                classificationId: null,
                errorStage: null,
                reasonCode: null,
                correlationId: null,
                sqlState: this.normalizeSqlState(context.sql_state || context.sqlState || error?.code)
            });

            logger.error('RAG error logged', {
                operation: boundedOperation,
                errorType: boundedErrorType,
            });
            return { logged: true, deduped: false };
        } catch {
            logger.warn('Failed to log RAG error', {
                reason_code: 'rag_error_log_failed'
            });
            return { logged: false, deduped: false };
        }
    }

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
        } catch {
            logger.error('Failed to get health summary', {
                reason_code: RAG_READ_LOG_REASON_IDS.HEALTH_SUMMARY_FAILED,
            });
            return null;
        }
    }

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
        } catch {
            logger.error('Failed to get recent errors', {
                reason_code: RAG_READ_LOG_REASON_IDS.RECENT_ERRORS_FAILED,
            });
            return [];
        }
    }

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
        } catch {
            logger.error('Failed to get metrics by operation', {
                reason_code: RAG_READ_LOG_REASON_IDS.METRICS_BY_OPERATION_FAILED,
            });
            return null;
        }
    }
}

export const ragLogger = new RAGLogger();
