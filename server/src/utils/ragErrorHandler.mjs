/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const RAG_ERROR_TYPES = {
    EMBEDDING_GENERATION: 'embedding_generation',
    HYBRID_SEARCH: 'hybrid_search',
    SEMANTIC_SEARCH: 'semantic_search',
    PATTERN_MINING: 'pattern_mining',
    SECOND_PASS_GATE: 'second_pass_gate',
    SECOND_PASS_ENRICHMENT: 'second_pass_enrichment',
    SECOND_PASS_RETRIEVAL_PASS2: 'second_pass_retrieval_pass2',
    SECOND_PASS_POLICY_RECHECK: 'second_pass_policy_recheck',
    SECOND_PASS_AI_RERUN: 'second_pass_ai_rerun',
    SECOND_PASS_TRACE: 'second_pass_trace',
    QUOTA_EXCEEDED: 'quota_exceeded',
    TIMEOUT: 'timeout',
    DIMENSION_MISMATCH: 'dimension_mismatch',
    INVALID_VECTOR: 'invalid_vector',
    DATABASE_ERROR: 'database_error',
    PROVIDER_ERROR: 'provider_error',
    CONFIGURATION_ERROR: 'configuration_error',
    UNKNOWN: 'unknown'
};

const RAG_SECOND_PASS_STAGES = Object.freeze({
    GATE: 'gate',
    ENRICHMENT: 'enrichment',
    RETRIEVAL_PASS2: 'retrieval_pass2',
    POLICY_RECHECK: 'policy_recheck',
    AI_RERUN: 'ai_rerun',
    RAG_CANDIDATE: 'rag_candidate',
    TRACE: 'trace'
});

const RAG_SECOND_PASS_REASON_CODES = Object.freeze({
    DB_INTEGRITY_VIOLATION: 'db_integrity_violation',
    DB_RETRYABLE_CONFLICT: 'db_retryable_conflict',
    DB_SCHEMA_MISMATCH: 'db_schema_mismatch',
    DB_UNKNOWN_FAILURE: 'db_unknown_failure',
    GATE_NOT_MET: 'gate_not_met',
    RAG_PASS1_CANDIDATE_FAILED: 'rag_pass1_candidate_failed',
    RAG_PASS1_CANDIDATE_TIMEOUT: 'rag_pass1_candidate_timeout',
    RAG_PASS1_CANDIDATE_PROVIDER_FAILED: 'rag_pass1_candidate_provider_failed',
    RAG_PASS1_CANDIDATE_DB_FAILED: 'rag_pass1_candidate_db_failed',
    RAG_PASS1_CANDIDATE_EMBED_FAILED: 'rag_pass1_candidate_embed_failed',
    RAG_PASS1_CANDIDATE_ABORTED: 'rag_pass1_candidate_aborted',
    METADATA_ENRICHMENT_FAILED: 'metadata_enrichment_failed',
    RAG_PASS2_FAILED: 'rag_pass2_failed',
    RAG_PASS2_TIMEOUT: 'rag_pass2_timeout',
    RAG_PASS2_PROVIDER_FAILED: 'rag_pass2_provider_failed',
    RAG_PASS2_DB_FAILED: 'rag_pass2_db_failed',
    RAG_PASS2_EMBED_FAILED: 'rag_pass2_embed_failed',
    RAG_PASS2_ABORTED: 'rag_pass2_aborted',
    POLICY_RECHECK_FAILED: 'policy_recheck_failed',
    AI_RERUN_FAILED: 'ai_rerun_failed',
    TRACE_BUILD_FAILED: 'trace_build_failed',
    UNKNOWN_STAGE_FAILURE: 'unknown_stage_failure'
});

const SECOND_PASS_STAGE_TO_TYPE = Object.freeze({
    [RAG_SECOND_PASS_STAGES.GATE]: RAG_ERROR_TYPES.SECOND_PASS_GATE,
    [RAG_SECOND_PASS_STAGES.ENRICHMENT]: RAG_ERROR_TYPES.SECOND_PASS_ENRICHMENT,
    [RAG_SECOND_PASS_STAGES.RETRIEVAL_PASS2]: RAG_ERROR_TYPES.SECOND_PASS_RETRIEVAL_PASS2,
    [RAG_SECOND_PASS_STAGES.POLICY_RECHECK]: RAG_ERROR_TYPES.SECOND_PASS_POLICY_RECHECK,
    [RAG_SECOND_PASS_STAGES.AI_RERUN]: RAG_ERROR_TYPES.SECOND_PASS_AI_RERUN,
    [RAG_SECOND_PASS_STAGES.RAG_CANDIDATE]: RAG_ERROR_TYPES.SECOND_PASS_RETRIEVAL_PASS2,
    [RAG_SECOND_PASS_STAGES.TRACE]: RAG_ERROR_TYPES.SECOND_PASS_TRACE
});

const SECOND_PASS_STAGE_DEFAULT_REASON = Object.freeze({
    [RAG_SECOND_PASS_STAGES.GATE]: RAG_SECOND_PASS_REASON_CODES.GATE_NOT_MET,
    [RAG_SECOND_PASS_STAGES.ENRICHMENT]: RAG_SECOND_PASS_REASON_CODES.METADATA_ENRICHMENT_FAILED,
    [RAG_SECOND_PASS_STAGES.RETRIEVAL_PASS2]: RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_FAILED,
    [RAG_SECOND_PASS_STAGES.POLICY_RECHECK]: RAG_SECOND_PASS_REASON_CODES.POLICY_RECHECK_FAILED,
    [RAG_SECOND_PASS_STAGES.AI_RERUN]: RAG_SECOND_PASS_REASON_CODES.AI_RERUN_FAILED,
    [RAG_SECOND_PASS_STAGES.RAG_CANDIDATE]: RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_FAILED,
    [RAG_SECOND_PASS_STAGES.TRACE]: RAG_SECOND_PASS_REASON_CODES.TRACE_BUILD_FAILED
});

function normalizeReasonCode(reasonCode) {
    if (typeof reasonCode !== 'string') {
        return null;
    }

    const normalized = reasonCode
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || null;
}

function normalizeSecondPassStage(stage) {
    const value = typeof stage === 'string' ? stage.trim().toLowerCase() : '';
    if (!value) {
        return null;
    }

    return Object.values(RAG_SECOND_PASS_STAGES).includes(value) ? value : null;
}

function normalizeSqlState(error) {
    const raw = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
    if (!raw) {
        return null;
    }
    return /^(?=.*[0-9])[A-Z0-9]{5}$/.test(raw) ? raw : null;
}

function mapSqlStateReason(sqlState) {
    if (!sqlState) {
        return {
            reasonCode: null,
            recoverable: true
        };
    }

    if (sqlState.startsWith('23')) {
        return {
            reasonCode: RAG_SECOND_PASS_REASON_CODES.DB_INTEGRITY_VIOLATION,
            recoverable: false
        };
    }

    if (sqlState.startsWith('40')) {
        return {
            reasonCode: RAG_SECOND_PASS_REASON_CODES.DB_RETRYABLE_CONFLICT,
            recoverable: true
        };
    }

    if (sqlState.startsWith('42')) {
        return {
            reasonCode: RAG_SECOND_PASS_REASON_CODES.DB_SCHEMA_MISMATCH,
            recoverable: false
        };
    }

    return {
        reasonCode: RAG_SECOND_PASS_REASON_CODES.DB_UNKNOWN_FAILURE,
        recoverable: true
    };
}

const TIMEOUT_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNABORTED', 'ERR_TIMEOUT']);
const ABORT_ERROR_CODES = new Set(['ABORT_ERR', 'ERR_CANCELED']);
const PROVIDER_HINTS = ['provider', 'ollama', 'openai', 'gemini', 'anthropic'];
const EMBEDDING_HINTS = ['embedding', 'vector', 'embed'];
const DATABASE_HINTS = ['database', 'postgres', 'sql', 'query failed'];

function getNormalizedErrorCode(error) {
    if (typeof error?.code !== 'string') {
        return '';
    }
    return error.code.trim().toUpperCase();
}

function getNormalizedMessage(error) {
    if (typeof error?.message !== 'string') {
        return '';
    }
    return error.message.trim().toLowerCase();
}

function isTimeoutLikeError(error) {
    const code = getNormalizedErrorCode(error);
    const name = typeof error?.name === 'string' ? error.name.trim() : '';
    const message = getNormalizedMessage(error);

    return (
        name === 'TimeoutError' ||
        TIMEOUT_ERROR_CODES.has(code) ||
        message.includes('timeout') ||
        message.includes('timed out')
    );
}

function isAbortLikeError(error) {
    const code = getNormalizedErrorCode(error);
    const name = typeof error?.name === 'string' ? error.name.trim() : '';
    const message = getNormalizedMessage(error);

    return (
        name === 'AbortError' ||
        ABORT_ERROR_CODES.has(code) ||
        message.includes('aborted') ||
        message.includes('cancelled') ||
        message.includes('canceled')
    );
}

function includesAny(message, values) {
    return values.some((value) => message.includes(value));
}

function isProviderLikeError(error) {
    const message = getNormalizedMessage(error);
    if (!message) {
        return false;
    }
    return includesAny(message, PROVIDER_HINTS);
}

function categorizeError(error) {
    const message = error.message?.toLowerCase() || '';

    if (error instanceof RAGError) {
        return error.type;
    }

    if (message.includes('policy recheck') || message.includes('policy_recheck')) {
        return RAG_ERROR_TYPES.SECOND_PASS_POLICY_RECHECK;
    }
    if (message.includes('pass2') || message.includes('retrieval_pass2') || message.includes('second pass retrieval')) {
        return RAG_ERROR_TYPES.SECOND_PASS_RETRIEVAL_PASS2;
    }
    if (message.includes('enrichment')) {
        return RAG_ERROR_TYPES.SECOND_PASS_ENRICHMENT;
    }
    if (message.includes('ai rerun') || message.includes('ai_rerun')) {
        return RAG_ERROR_TYPES.SECOND_PASS_AI_RERUN;
    }
    if (message.includes('trace build') || message.includes('trace_')) {
        return RAG_ERROR_TYPES.SECOND_PASS_TRACE;
    }

    if (message.includes('quota') || message.includes('rate limit') ||
        message.includes('too many requests') || error.code === 'RATE_LIMIT_EXCEEDED') {
        return RAG_ERROR_TYPES.QUOTA_EXCEEDED;
    }

    if (message.includes('timeout') || message.includes('timed out') ||
        error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return RAG_ERROR_TYPES.TIMEOUT;
    }

    if (message.includes('dimension') || message.includes('vector size') ||
        message.includes('embedding size')) {
        return RAG_ERROR_TYPES.DIMENSION_MISMATCH;
    }

    if (message.includes('invalid vector') || message.includes('nan') ||
        message.includes('infinity') || message.includes('vector format')) {
        return RAG_ERROR_TYPES.INVALID_VECTOR;
    }

    if (message.includes('database') || message.includes('postgres') ||
        message.includes('sql') || error.code?.startsWith('23') || error.code?.startsWith('42')) {
        return RAG_ERROR_TYPES.DATABASE_ERROR;
    }

    if (message.includes('provider') || message.includes('ollama') ||
        message.includes('openai') || message.includes('gemini')) {
        return RAG_ERROR_TYPES.PROVIDER_ERROR;
    }

    if (message.includes('config') || message.includes('not configured') ||
        message.includes('missing') && message.includes('setting')) {
        return RAG_ERROR_TYPES.CONFIGURATION_ERROR;
    }

    if (message.includes('embedding')) {
        return RAG_ERROR_TYPES.EMBEDDING_GENERATION;
    }
    if (message.includes('semantic search') || message.includes('similarity search')) {
        return RAG_ERROR_TYPES.SEMANTIC_SEARCH;
    }
    if (message.includes('hybrid search')) {
        return RAG_ERROR_TYPES.HYBRID_SEARCH;
    }
    if (message.includes('pattern')) {
        return RAG_ERROR_TYPES.PATTERN_MINING;
    }

    return RAG_ERROR_TYPES.UNKNOWN;
}

function isEmbeddingLikeError(error) {
    const message = getNormalizedMessage(error);
    if (!message) {
        return false;
    }
    if (includesAny(message, EMBEDDING_HINTS)) {
        return true;
    }
    return categorizeError(error) === RAG_ERROR_TYPES.EMBEDDING_GENERATION;
}

function isDatabaseLikeError(error, sqlState = null) {
    if (sqlState) {
        return true;
    }

    const message = getNormalizedMessage(error);
    if (!message) {
        return false;
    }
    if (includesAny(message, DATABASE_HINTS)) {
        return true;
    }
    return categorizeError(error) === RAG_ERROR_TYPES.DATABASE_ERROR;
}

function hasPass1ReasonContext(reasonCode = null, fallbackReasonCode = null) {
    const reason = normalizeReasonCode(reasonCode);
    const fallback = normalizeReasonCode(fallbackReasonCode);
    return (
        reason?.startsWith('rag_pass1_candidate_') ||
        fallback?.startsWith('rag_pass1_candidate_')
    );
}

function hasPass2ReasonContext(reasonCode = null, fallbackReasonCode = null) {
    const reason = normalizeReasonCode(reasonCode);
    const fallback = normalizeReasonCode(fallbackReasonCode);
    return (
        reason?.startsWith('rag_pass2_') ||
        fallback?.startsWith('rag_pass2_')
    );
}

function mapRetrievalReasonCode({
    pass,
    error,
    sqlState = null
} = {}) {
    if (pass !== 'pass1' && pass !== 'pass2') {
        return null;
    }

    if (isTimeoutLikeError(error)) {
        return pass === 'pass1'
            ? RAG_SECOND_PASS_REASON_CODES.RAG_PASS1_CANDIDATE_TIMEOUT
            : RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_TIMEOUT;
    }
    if (isAbortLikeError(error)) {
        return pass === 'pass1'
            ? RAG_SECOND_PASS_REASON_CODES.RAG_PASS1_CANDIDATE_ABORTED
            : RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_ABORTED;
    }
    if (isDatabaseLikeError(error, sqlState)) {
        return pass === 'pass1'
            ? RAG_SECOND_PASS_REASON_CODES.RAG_PASS1_CANDIDATE_DB_FAILED
            : RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_DB_FAILED;
    }
    if (isEmbeddingLikeError(error)) {
        return pass === 'pass1'
            ? RAG_SECOND_PASS_REASON_CODES.RAG_PASS1_CANDIDATE_EMBED_FAILED
            : RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_EMBED_FAILED;
    }
    if (isProviderLikeError(error)) {
        return pass === 'pass1'
            ? RAG_SECOND_PASS_REASON_CODES.RAG_PASS1_CANDIDATE_PROVIDER_FAILED
            : RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_PROVIDER_FAILED;
    }

    return pass === 'pass1'
        ? RAG_SECOND_PASS_REASON_CODES.RAG_PASS1_CANDIDATE_FAILED
        : RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_FAILED;
}

function mapSecondPassError({
    stage = null,
    reasonCode = null,
    fallbackReasonCode = null,
    error = null
} = {}) {
    const normalizedStage = normalizeSecondPassStage(stage);
    const normalizedReason = normalizeReasonCode(reasonCode);
    const normalizedFallbackReason = normalizeReasonCode(fallbackReasonCode);
    const errorType = normalizedStage
        ? SECOND_PASS_STAGE_TO_TYPE[normalizedStage] || RAG_ERROR_TYPES.UNKNOWN
        : categorizeError(error || {});
    const sqlState = normalizeSqlState(error);
    const sqlStateResolution = mapSqlStateReason(sqlState);

    let resolvedReason = normalizedReason;
    let recoverable = sqlStateResolution.recoverable;

    if (
        !resolvedReason &&
        sqlStateResolution.reasonCode &&
        sqlStateResolution.reasonCode !== RAG_SECOND_PASS_REASON_CODES.DB_UNKNOWN_FAILURE
    ) {
        resolvedReason = sqlStateResolution.reasonCode;
    }

    if (!resolvedReason && (hasPass1ReasonContext(normalizedReason, normalizedFallbackReason) || normalizedStage === RAG_SECOND_PASS_STAGES.GATE)) {
        resolvedReason = mapRetrievalReasonCode({ pass: 'pass1', error, sqlState });
        recoverable = !sqlState || sqlStateResolution.recoverable;
    }

    if (!resolvedReason && (hasPass2ReasonContext(normalizedReason, normalizedFallbackReason) || normalizedStage === RAG_SECOND_PASS_STAGES.RETRIEVAL_PASS2)) {
        resolvedReason = mapRetrievalReasonCode({ pass: 'pass2', error, sqlState });
        recoverable = !sqlState || sqlStateResolution.recoverable;
    }

    if (!resolvedReason && normalizedFallbackReason) {
        resolvedReason = normalizedFallbackReason;
    }

    if (!resolvedReason && normalizedStage) {
        resolvedReason = SECOND_PASS_STAGE_DEFAULT_REASON[normalizedStage] || RAG_SECOND_PASS_REASON_CODES.UNKNOWN_STAGE_FAILURE;
    }

    return {
        errorType,
        reasonCode: resolvedReason,
        sqlState,
        recoverable
    };
}

class RAGError extends Error {
    constructor(message, type = RAG_ERROR_TYPES.UNKNOWN, context = {}, recoverable = true) {
        super(message);
        this.name = 'RAGError';
        this.type = type;
        this.context = context;
        this.recoverable = recoverable;
        this.timestamp = new Date().toISOString();
    }
}

function isRecoverable(error) {
    const errorType = categorizeError(error);
    return ![
        RAG_ERROR_TYPES.DIMENSION_MISMATCH,
        RAG_ERROR_TYPES.INVALID_VECTOR,
        RAG_ERROR_TYPES.CONFIGURATION_ERROR,
    ].includes(errorType);
}

async function withRAGErrorHandling(operation, operationName, context = {}) {
    const startTime = Date.now();

    try {
        const result = await operation();
        const duration = Date.now() - startTime;

        if (result && typeof result === 'object' && !Array.isArray(result)) {
            result._duration_ms = duration;
        }

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorType = categorizeError(error);
        const recoverable = isRecoverable(error);

        const ragError = error instanceof RAGError ? error : new RAGError(
            error.message,
            errorType,
            {
                ...context,
                operation: operationName,
                duration_ms: duration,
                originalError: error.name
            },
            recoverable
        );

        if (!ragError.stack && error.stack) {
            ragError.stack = error.stack;
        }

        throw ragError;
    }
}

export {
    RAGError,
    RAG_ERROR_TYPES,
    RAG_SECOND_PASS_REASON_CODES,
    RAG_SECOND_PASS_STAGES,
    categorizeError,
    isRecoverable,
    mapSecondPassError,
    normalizeReasonCode,
    normalizeSecondPassStage,
    withRAGErrorHandling
};
