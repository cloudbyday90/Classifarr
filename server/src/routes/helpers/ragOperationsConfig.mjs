/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ValidationError } from '../../utils/appError.mjs';

export const DEFAULT_ADVANCED_CONFIG = {
    max_retries: 3,
    retry_delay: 1000,
    request_timeout: 30000,
    cache_enabled: false,
    cache_ttl: 24,
    verbose_logging: false,
    log_embedding_content: false
};

export const DEFAULT_RETRY_CONFIG = {
    request_timeout: 30000,
    warmup_timeout: 120000,
    max_retries: 3,
    retry_delay: 1000,
    retry_backoff_multiplier: 2,
    jitter_factor: 0.3
};

export async function getAdvancedConfig({ db }) {
    const config = await db.query(`
        SELECT
            max_retries, retry_delay, request_timeout,
            cache_enabled, cache_ttl,
            verbose_logging, log_embedding_content
        FROM ai_provider_config WHERE id = 1
    `);

    if (config.rows.length === 0) {
        return { ...DEFAULT_ADVANCED_CONFIG };
    }

    return config.rows[0];
}

export async function updateAdvancedConfig({ db }, payload = {}) {
    const {
        max_retries, retry_delay, request_timeout,
        cache_enabled, cache_ttl,
        verbose_logging, log_embedding_content
    } = payload;

    await db.query(`
        UPDATE ai_provider_config SET
            max_retries = $1,
            retry_delay = $2,
            request_timeout = $3,
            cache_enabled = $4,
            cache_ttl = $5,
            verbose_logging = $6,
            log_embedding_content = $7
        WHERE id = 1
    `, [max_retries, retry_delay, request_timeout, cache_enabled, cache_ttl, verbose_logging, log_embedding_content]);

    return { success: true };
}

export async function getRetryConfig({ db }) {
    const config = await db.query(`
        SELECT
            request_timeout,
            warmup_timeout,
            max_retries,
            retry_delay,
            retry_backoff_multiplier,
            jitter_factor
        FROM ai_provider_config WHERE id = 1
    `);

    if (config.rows.length === 0) {
        return { ...DEFAULT_RETRY_CONFIG };
    }

    return config.rows[0];
}

export function validateRetryConfig(payload = {}) {
    const {
        request_timeout,
        warmup_timeout,
        max_retries,
        retry_delay,
        retry_backoff_multiplier,
        jitter_factor
    } = payload;

    const errors = [];

    if (request_timeout !== undefined && (request_timeout < 5000 || request_timeout > 300000)) {
        errors.push('request_timeout must be between 5000 and 300000 (5s-300s)');
    }

    if (warmup_timeout !== undefined && (warmup_timeout < 10000 || warmup_timeout > 600000)) {
        errors.push('warmup_timeout must be between 10000 and 600000 (10s-600s)');
    }

    if (max_retries !== undefined && (max_retries < 0 || max_retries > 10)) {
        errors.push('max_retries must be between 0 and 10');
    }

    if (retry_delay !== undefined && (retry_delay < 100 || retry_delay > 10000)) {
        errors.push('retry_delay must be between 100 and 10000 (100ms-10s)');
    }

    if (retry_backoff_multiplier !== undefined && (retry_backoff_multiplier < 1 || retry_backoff_multiplier > 5)) {
        errors.push('retry_backoff_multiplier must be between 1 and 5');
    }

    if (jitter_factor !== undefined && (jitter_factor < 0 || jitter_factor > 1)) {
        errors.push('jitter_factor must be between 0 and 1');
    }

    if (errors.length > 0) {
        throw new ValidationError('Validation failed', { details: errors });
    }
}

export async function updateRetryConfig({ db }, payload = {}) {
    validateRetryConfig(payload);

    const {
        request_timeout,
        warmup_timeout,
        max_retries,
        retry_delay,
        retry_backoff_multiplier,
        jitter_factor
    } = payload;

    await db.query(`
        UPDATE ai_provider_config SET
            request_timeout = $1,
            warmup_timeout = $2,
            max_retries = $3,
            retry_delay = $4,
            retry_backoff_multiplier = $5,
            jitter_factor = $6
        WHERE id = 1
    `, [request_timeout, warmup_timeout, max_retries, retry_delay, retry_backoff_multiplier, jitter_factor]);

    return { success: true };
}

export async function exportConfig({ db }) {
    const config = await db.query(`
        SELECT * FROM ai_provider_config WHERE id = 1
    `);

    return config.rows[0] || {};
}
