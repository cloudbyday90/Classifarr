/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ValidationError } from '../../utils/appError.mjs';

const BACKFILL_CONFIG_DEFAULTS = Object.freeze({
    realtime_embedding_enabled: true,
    idle_backfill_enabled: true,
    idle_threshold: 30000,
    idle_batch_size: 10,
    scheduled_backfill_enabled: true,
    scheduled_backfill_time: '02:00',
    scheduled_backfill_days: '0,1,2,3,4,5,6',
    scheduled_backfill_batch_size: 100,
    scheduled_backfill_max_duration: 3600000
});

const RESET_CONFIG_DEFAULTS = Object.freeze({
    embedding_provider_mode: 'same',
    embedding_ollama_host: null,
    embedding_ollama_port: 11434,
    embedding_ollama_model: null,
    embedding_cloud_provider: null,
    embedding_cloud_api_key: null,
    embedding_cloud_model: null,
    image_embedding_provider_mode: 'disabled',
    image_embedding_local_host: null,
    image_embedding_local_port: 8000,
    image_embedding_local_model: null,
    image_embedding_cloud_provider: null,
    image_embedding_cloud_api_key: null,
    image_embedding_cloud_model: null,
    image_embedding_cloud_api_endpoint: null,
    ...BACKFILL_CONFIG_DEFAULTS,
    manual_backfill_batch_size: 50,
    max_retries: 3,
    retry_delay: 1000,
    request_timeout: 30000,
    cache_enabled: false,
    cache_ttl: 24,
    verbose_logging: false,
    log_embedding_content: false
});

export function getRagBackfillConfigDefaults() {
    return { ...BACKFILL_CONFIG_DEFAULTS };
}

export function getRagResetConfigDefaults() {
    return { ...RESET_CONFIG_DEFAULTS };
}

function validatePositiveIntegerField(payload, fieldName, errors) {
    const value = payload[fieldName];
    if (value === undefined || value === null || value === '') {
        return;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        errors.push(`${fieldName} must be a positive integer`);
    }
}

export function validateRagBackfillConfigUpdate(payload = {}) {
    const errors = [];
    validatePositiveIntegerField(payload, 'idle_threshold', errors);
    validatePositiveIntegerField(payload, 'idle_batch_size', errors);
    validatePositiveIntegerField(payload, 'scheduled_backfill_batch_size', errors);
    validatePositiveIntegerField(payload, 'scheduled_backfill_max_duration', errors);

    if (errors.length > 0) {
        throw new ValidationError('Validation failed', { details: errors });
    }
}
