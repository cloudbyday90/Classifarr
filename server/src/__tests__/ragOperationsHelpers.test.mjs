/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
    createRagOperationsHelpers,
    registerRagOperationsRoutes
} from '../routes/helpers/ragOperationsHelpers.mjs';

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

    test('resetConfig resets image embedding defaults to disabled sidecar settings', async () => {
        const db = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
        };
        const helpers = buildHelpers({ db });

        await expect(helpers.resetConfig()).resolves.toEqual({
            success: true,
            message: 'Configuration reset to defaults'
        });

        const [sql, params] = db.query.mock.calls[0];
        expect(sql).toContain('image_embedding_provider_mode = $8');
        expect(sql).toContain('image_embedding_local_port = $10');
        expect(params.slice(7, 15)).toEqual([
            'disabled',
            null,
            8000,
            null,
            null,
            null,
            null,
            null
        ]);
    });

    test('registerRagOperationsRoutes covers success, validation, and failure response branches', async () => {
        const logger = {
            error: jest.fn()
        };
        const helpers = {
            clearEmbeddings: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('clear embeddings failed')),
            clearLogs: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('clear logs failed')),
            exportConfig: jest.fn()
                .mockResolvedValueOnce({ provider: 'openai' })
                .mockRejectedValueOnce(new Error('export config failed')),
            exportLogs: jest.fn()
                .mockResolvedValueOnce({ logs: [] })
                .mockRejectedValueOnce(new Error('export logs failed')),
            exportMetrics: jest.fn()
                .mockResolvedValueOnce({ metrics: [] })
                .mockRejectedValueOnce(new Error('export metrics failed')),
            getAdvancedConfig: jest.fn()
                .mockResolvedValueOnce({ cache_enabled: false })
                .mockRejectedValueOnce(new Error('advanced failed')),
            getLogsPayload: jest.fn()
                .mockResolvedValueOnce({ logs: [] })
                .mockRejectedValueOnce(new Error('logs failed')),
            getRetryConfig: jest.fn()
                .mockResolvedValueOnce({ max_retries: 3 })
                .mockRejectedValueOnce(new Error('retry failed')),
            reembedImages: jest.fn()
                .mockResolvedValueOnce({ success: true, cleared: 4 })
                .mockRejectedValueOnce(new Error('reembed failed')),
            resetConfig: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('reset failed')),
            updateAdvancedConfig: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('update advanced failed')),
            updateRetryConfig: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(Object.assign(new Error('Validation failed'), {
                    status: 400,
                    details: ['bad retry delay']
                }))
                .mockRejectedValueOnce(new Error('update retry failed'))
        };

        const app = express();
        const router = express.Router();
        app.use(express.json());
        registerRagOperationsRoutes({ router, logger, helpers });
        app.use('/rag', router);

        await request(app).get('/rag/logs').expect(200, { logs: [] });
        await request(app).get('/rag/logs').expect(500, { error: 'logs failed' });

        await request(app).delete('/rag/logs').expect(200, { success: true });
        await request(app).delete('/rag/logs').expect(500, { error: 'clear logs failed' });

        await request(app).get('/rag/advanced').expect(200, { cache_enabled: false });
        await request(app).get('/rag/advanced').expect(500, { error: 'advanced failed' });

        await request(app).put('/rag/advanced').send({}).expect(200, { success: true });
        await request(app).put('/rag/advanced').send({}).expect(500, { error: 'update advanced failed' });

        await request(app).get('/rag/settings/embedding/retry').expect(200, { max_retries: 3 });
        await request(app).get('/rag/settings/embedding/retry').expect(500, { error: 'retry failed' });

        await request(app).put('/rag/settings/embedding/retry').send({}).expect(200, { success: true });
        await request(app).put('/rag/settings/embedding/retry').send({}).expect(400, {
            error: 'Validation failed',
            details: ['bad retry delay']
        });
        await request(app).put('/rag/settings/embedding/retry').send({}).expect(500, { error: 'update retry failed' });

        await request(app).post('/rag/export/config').expect(200, { provider: 'openai' });
        await request(app).post('/rag/export/config').expect(500, { error: 'export config failed' });

        await request(app).post('/rag/export/logs').expect(200, { logs: [] });
        await request(app).post('/rag/export/logs').expect(500, { error: 'export logs failed' });

        await request(app).post('/rag/export/metrics').expect(200, { metrics: [] });
        await request(app).post('/rag/export/metrics').expect(500, { error: 'export metrics failed' });

        await request(app).post('/rag/clear-embeddings').expect(200, { success: true });
        await request(app).post('/rag/clear-embeddings').expect(500, { error: 'clear embeddings failed' });

        await request(app).post('/rag/reembed-images').expect(200, { success: true, cleared: 4 });
        await request(app).post('/rag/reembed-images').expect(500, { error: 'reembed failed' });

        await request(app).post('/rag/reset-config').expect(200, { success: true });
        await request(app).post('/rag/reset-config').expect(500, { error: 'reset failed' });

        expect(logger.error).toHaveBeenCalledWith('Failed to get logs', { error: 'logs failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to clear logs', { error: 'clear logs failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get advanced config', { error: 'advanced failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to update advanced config', { error: 'update advanced failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get retry config', { error: 'retry failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to update retry config', { error: 'update retry failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to export config', { error: 'export config failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to export logs', { error: 'export logs failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to export metrics', { error: 'export metrics failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to clear embeddings', { error: 'clear embeddings failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to clear image embeddings', { error: 'reembed failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to reset config', { error: 'reset failed' });
    });
});
