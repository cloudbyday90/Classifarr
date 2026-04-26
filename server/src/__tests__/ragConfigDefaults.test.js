/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const {
    getRagBackfillConfigDefaults,
    getRagResetConfigDefaults,
    validateRagBackfillConfigUpdate
} = require('../routes/helpers/ragConfigDefaults');

describe('ragConfigDefaults', () => {
    test('returns a stable backfill defaults snapshot', () => {
        expect(getRagBackfillConfigDefaults()).toEqual({
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
    });

    test('returns reset defaults that include the shared backfill defaults', () => {
        const defaults = getRagResetConfigDefaults();

        expect(defaults).toMatchObject({
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
            realtime_embedding_enabled: true,
            idle_backfill_enabled: true,
            idle_threshold: 30000,
            idle_batch_size: 10,
            scheduled_backfill_enabled: true,
            scheduled_backfill_time: '02:00',
            scheduled_backfill_days: '0,1,2,3,4,5,6',
            scheduled_backfill_batch_size: 100,
            scheduled_backfill_max_duration: 3600000,
            manual_backfill_batch_size: 50,
            max_retries: 3,
            retry_delay: 1000,
            request_timeout: 30000,
            cache_enabled: false,
            cache_ttl: 24,
            verbose_logging: false,
            log_embedding_content: false
        });
    });

    test('validateRagBackfillConfigUpdate rejects invalid numeric config values', () => {
        let error;
        try {
            validateRagBackfillConfigUpdate({
                idle_threshold: 0,
                idle_batch_size: 'nope',
                scheduled_backfill_batch_size: -1,
                scheduled_backfill_max_duration: 'NaN'
            });
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toMatchObject({
            message: 'Validation failed',
            status: 400,
            details: [
                'idle_threshold must be a positive integer',
                'idle_batch_size must be a positive integer',
                'scheduled_backfill_batch_size must be a positive integer',
                'scheduled_backfill_max_duration must be a positive integer'
            ]
        });
    });
});
