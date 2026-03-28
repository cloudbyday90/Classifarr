/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { createRagOperationsHelpers } = require('../routes/helpers/ragOperationsHelpers');

describe('ragOperationsHelpers', () => {
    const buildHelpers = (overrides = {}) => createRagOperationsHelpers({
        db: {
            query: jest.fn()
        },
        ...overrides
    });

    test('getLogsPayload builds filtered query params with parsed paging values', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({
                rows: [{ id: 1, level: 'warning' }]
            })
        };
        const helpers = buildHelpers({ db });

        const result = await helpers.getLogsPayload({
            level: 'warning',
            type: 'system',
            limit: '25',
            offset: '10'
        });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('AND level = $1'),
            ['warning', 'system', 25, 10]
        );
        expect(result).toEqual({
            logs: [{ id: 1, level: 'warning' }]
        });
    });

    test('getAdvancedConfig returns defaults when ai_provider_config is missing', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({ rows: [] })
        };
        const helpers = buildHelpers({ db });

        await expect(helpers.getAdvancedConfig()).resolves.toEqual({
            max_retries: 3,
            retry_delay: 1000,
            request_timeout: 30000,
            cache_enabled: false,
            cache_ttl: 24,
            verbose_logging: false,
            log_embedding_content: false
        });
    });

    test('updateRetryConfig rejects invalid retry values with structured validation errors', async () => {
        const helpers = buildHelpers();

        await expect(helpers.updateRetryConfig({
            request_timeout: 4000,
            warmup_timeout: 900000,
            max_retries: 42,
            retry_delay: 50,
            retry_backoff_multiplier: 9,
            jitter_factor: 1.5
        })).rejects.toMatchObject({
            status: 400,
            message: 'Validation failed',
            details: [
                'request_timeout must be between 5000 and 300000 (5s-300s)',
                'warmup_timeout must be between 10000 and 600000 (10s-600s)',
                'max_retries must be between 0 and 10',
                'retry_delay must be between 100 and 10000 (100ms-10s)',
                'retry_backoff_multiplier must be between 1 and 5',
                'jitter_factor must be between 0 and 1'
            ]
        });
    });

    test('reembedImages clears image embedding fields and records an audit log entry', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({ rowCount: 7 })
                .mockResolvedValueOnce({ rows: [] })
        };
        const helpers = buildHelpers({ db });

        const result = await helpers.reembedImages();

        expect(db.query).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('UPDATE classification_embeddings')
        );
        expect(db.query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('Image embeddings cleared by user for re-embedding')
        );
        expect(result).toEqual({
            success: true,
            cleared: 7
        });
    });
});
