/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * RAG Error Handler Utility
 * Provides error categorization and handling for RAG operations
 */

// RAG-specific error types
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
    TRACE: 'trace'
});

const RAG_SECOND_PASS_REASON_CODES = Object.freeze({
    DB_INTEGRITY_VIOLATION: 'db_integrity_violation',
    DB_RETRYABLE_CONFLICT: 'db_retryable_conflict',
    DB_SCHEMA_MISMATCH: 'db_schema_mismatch',
    DB_UNKNOWN_FAILURE: 'db_unknown_failure',
    GATE_NOT_MET: 'gate_not_met',
    METADATA_ENRICHMENT_FAILED: 'metadata_enrichment_failed',
    RAG_PASS2_FAILED: 'rag_pass2_failed',
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
    [RAG_SECOND_PASS_STAGES.TRACE]: RAG_ERROR_TYPES.SECOND_PASS_TRACE
});

const SECOND_PASS_STAGE_DEFAULT_REASON = Object.freeze({
    [RAG_SECOND_PASS_STAGES.GATE]: RAG_SECOND_PASS_REASON_CODES.GATE_NOT_MET,
    [RAG_SECOND_PASS_STAGES.ENRICHMENT]: RAG_SECOND_PASS_REASON_CODES.METADATA_ENRICHMENT_FAILED,
    [RAG_SECOND_PASS_STAGES.RETRIEVAL_PASS2]: RAG_SECOND_PASS_REASON_CODES.RAG_PASS2_FAILED,
    [RAG_SECOND_PASS_STAGES.POLICY_RECHECK]: RAG_SECOND_PASS_REASON_CODES.POLICY_RECHECK_FAILED,
    [RAG_SECOND_PASS_STAGES.AI_RERUN]: RAG_SECOND_PASS_REASON_CODES.AI_RERUN_FAILED,
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
    return /^[A-Z0-9]{5}$/.test(raw) ? raw : null;
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

function mapSecondPassError({
    stage = null,
    reasonCode = null,
    fallbackReasonCode = null,
    error = null
} = {}) {
    const normalizedStage = normalizeSecondPassStage(stage);
    const stageErrorType = normalizedStage ? SECOND_PASS_STAGE_TO_TYPE[normalizedStage] : null;
    const sqlState = normalizeSqlState(error);
    const sqlStateReason = mapSqlStateReason(sqlState);
    const normalizedReason = normalizeReasonCode(reasonCode);
    const normalizedFallbackReason = normalizeReasonCode(fallbackReasonCode);
    const defaultReason = normalizedStage
        ? SECOND_PASS_STAGE_DEFAULT_REASON[normalizedStage]
        : RAG_SECOND_PASS_REASON_CODES.UNKNOWN_STAGE_FAILURE;

    const mappedReasonCode =
        sqlStateReason.reasonCode ||
        normalizedReason ||
        normalizedFallbackReason ||
        defaultReason;

    const recoverable = typeof error?.recoverable === 'boolean'
        ? error.recoverable
        : sqlStateReason.recoverable;

    return {
        stage: normalizedStage,
        errorType: stageErrorType || categorizeError(error || new Error('unknown_stage_error')),
        reasonCode: mappedReasonCode,
        sqlState,
        recoverable
    };
}

/**
 * Custom RAG Error class
 */
class RAGError extends Error {
    constructor(message, type = RAG_ERROR_TYPES.UNKNOWN, context = {}, recoverable = true) {
        super(message);
        this.name = 'RAGError';
        this.type = type;
        this.context = context;
        this.recoverable = recoverable;
        this.timestamp = new Date();
        
        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RAGError);
        }
    }

    /**
     * Convert error to JSON format for logging
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            context: this.context,
            recoverable: this.recoverable,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Categorize error based on message and properties
 * @param {Error} error - Error to categorize
 * @returns {string} Error type from RAG_ERROR_TYPES
 */
function categorizeError(error) {
    const message = error.message?.toLowerCase() || '';
    
    // Check if already a RAGError
    if (error instanceof RAGError) {
        return error.type;
    }

    // Second-pass stage hints
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
    
    // Quota/rate limit errors
    if (message.includes('quota') || message.includes('rate limit') || 
        message.includes('too many requests') || error.code === 'RATE_LIMIT_EXCEEDED') {
        return RAG_ERROR_TYPES.QUOTA_EXCEEDED;
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out') || 
        error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        return RAG_ERROR_TYPES.TIMEOUT;
    }
    
    // Dimension mismatch
    if (message.includes('dimension') || message.includes('vector size') ||
        message.includes('embedding size')) {
        return RAG_ERROR_TYPES.DIMENSION_MISMATCH;
    }
    
    // Invalid vector
    if (message.includes('invalid vector') || message.includes('nan') ||
        message.includes('infinity') || message.includes('vector format')) {
        return RAG_ERROR_TYPES.INVALID_VECTOR;
    }
    
    // Database errors (PostgreSQL error codes)
    // 23xxx: Integrity constraint violations
    // 42xxx: Syntax errors and access rule violations
    if (message.includes('database') || message.includes('postgres') ||
        message.includes('sql') || error.code?.startsWith('23') || error.code?.startsWith('42')) {
        return RAG_ERROR_TYPES.DATABASE_ERROR;
    }
    
    // Provider errors
    if (message.includes('provider') || message.includes('ollama') ||
        message.includes('openai') || message.includes('gemini')) {
        return RAG_ERROR_TYPES.PROVIDER_ERROR;
    }
    
    // Configuration errors
    if (message.includes('config') || message.includes('not configured') ||
        message.includes('missing') && message.includes('setting')) {
        return RAG_ERROR_TYPES.CONFIGURATION_ERROR;
    }
    
    // Operation-specific errors
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

/**
 * Determine if error is recoverable
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is recoverable
 */
function isRecoverable(error) {
    const type = categorizeError(error);
    
    // These errors are generally recoverable with retry
    const recoverableTypes = [
        RAG_ERROR_TYPES.TIMEOUT,
        RAG_ERROR_TYPES.QUOTA_EXCEEDED,
        RAG_ERROR_TYPES.PROVIDER_ERROR,
        RAG_ERROR_TYPES.DATABASE_ERROR
    ];
    
    return recoverableTypes.includes(type);
}

/**
 * Wrapper function to handle RAG operations with error handling
 * @param {Function} operation - Async operation to execute
 * @param {string} operationName - Name of the operation for logging
 * @param {object} context - Additional context for error logging
 * @returns {Promise} Operation result or throws RAGError
 */
async function withRAGErrorHandling(operation, operationName, context = {}) {
    const startTime = Date.now();
    
    try {
        const result = await operation();
        const duration = Date.now() - startTime;
        
        // Add duration to result if it's an object
        if (result && typeof result === 'object' && !Array.isArray(result)) {
            result._duration_ms = duration;
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorType = categorizeError(error);
        const recoverable = isRecoverable(error);
        
        // Create RAGError if not already one
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
        
        // Preserve original stack if available
        if (!ragError.stack && error.stack) {
            ragError.stack = error.stack;
        }
        
        throw ragError;
    }
}

module.exports = {
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
