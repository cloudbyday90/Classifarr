/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
    QUOTA_EXCEEDED: 'quota_exceeded',
    TIMEOUT: 'timeout',
    DIMENSION_MISMATCH: 'dimension_mismatch',
    INVALID_VECTOR: 'invalid_vector',
    DATABASE_ERROR: 'database_error',
    PROVIDER_ERROR: 'provider_error',
    CONFIGURATION_ERROR: 'configuration_error',
    UNKNOWN: 'unknown'
};

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
    categorizeError,
    isRecoverable,
    withRAGErrorHandling
};
