/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.mock('../services/classification', () => ({}));
jest.unstable_mockModule('../services/classification', () => ({ default: {} }));
jest.unstable_mockModule('../services/classification.mjs', () => ({ default: {} }));

const mockQueueService = {
    enqueue: jest.fn(),
};
jest.mock('../services/queueService', () => mockQueueService);
jest.unstable_mockModule('../services/queueService', () => ({ ...mockQueueService, default: mockQueueService }));
jest.unstable_mockModule('../services/queueService.mjs', () => ({ ...mockQueueService, default: mockQueueService }));

const mockWebhookService = {
    getConfig: jest.fn(),
    validateAuth: jest.fn(),
    sanitizePayload: jest.fn(),
    parsePayload: jest.fn(),
    logReceived: jest.fn(),
    updateLogStatus: jest.fn(),
    updateRequestStatus: jest.fn(),
};
jest.mock('../services/webhook', () => mockWebhookService);
jest.unstable_mockModule('../services/webhook', () => ({ ...mockWebhookService, default: mockWebhookService }));
jest.unstable_mockModule('../services/webhook.mjs', () => ({ ...mockWebhookService, default: mockWebhookService }));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));
jest.unstable_mockModule('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));

const queueService = mockQueueService;
const webhookService = mockWebhookService;
const createRateLimit = jest.fn(() => (_req, _res, next) => next());
const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

describe('Webhook Routes - authentication enforcement', () => {
    let app;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { createWebhookRouter } = await import('../routes/webhookRouteShared.mjs');
        webhookService.sanitizePayload.mockReset();
        webhookService.parsePayload.mockReset();
        webhookService.logReceived.mockReset();
        webhookService.updateLogStatus.mockReset();
        webhookService.updateRequestStatus.mockReset();
        app = express();
        app.use(express.json());
        app.use('/api/webhook', createWebhookRouter({
            express,
            rateLimit: createRateLimit,
            webhookService,
            queueService,
            logger,
        }));

        webhookService.sanitizePayload.mockImplementation((body) => ({ payload: body, specialsExcluded: 0 }));
        webhookService.parsePayload.mockReturnValue({
            notification_type: 'TEST_NOTIFICATION',
            event_name: 'test',
            media_type: 'movie',
            title: 'Test',
            tmdb_id: null,
            tvdb_id: null,
            request_id: null,
        });
        webhookService.logReceived.mockResolvedValue(101);
        webhookService.updateLogStatus.mockResolvedValue();
        webhookService.updateRequestStatus.mockResolvedValue();
    });

    test('returns 401 when webhook secret is not configured', async () => {
        webhookService.getConfig.mockResolvedValue({
            enabled: true,
            secret_key: null,
            include_specials: false,
        });

        const res = await request(app)
            .post('/api/webhook/request')
            .send({ notification_type: 'TEST_NOTIFICATION' });

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Webhook secret not configured');
        expect(webhookService.getConfig).toHaveBeenCalledWith({ mask: false });
        expect(webhookService.validateAuth).not.toHaveBeenCalled();
    });

    test('returns 401 for invalid webhook auth key', async () => {
        webhookService.getConfig.mockResolvedValue({
            enabled: true,
            secret_key: 'whsec_configured_secret',
            include_specials: false,
            process_pending: true,
            process_approved: true,
            process_auto_approved: true,
            process_declined: false,
        });
        webhookService.validateAuth.mockResolvedValue(false);

        const res = await request(app)
            .post('/api/webhook/request')
            .set('x-webhook-key', 'invalid-key')
            .send({ notification_type: 'TEST_NOTIFICATION' });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({
            success: false,
            error: 'Invalid webhook key',
        });
        expect(queueService.enqueue).not.toHaveBeenCalled();
    });

    test('accepts valid auth and processes test notification', async () => {
        webhookService.getConfig.mockResolvedValue({
            enabled: true,
            secret_key: 'whsec_configured_secret',
            include_specials: false,
            process_pending: true,
            process_approved: true,
            process_auto_approved: true,
            process_declined: false,
        });
        webhookService.validateAuth.mockResolvedValue(true);

        const res = await request(app)
            .post('/api/webhook/request')
            .set('x-webhook-key', 'whsec_configured_secret')
            .send({ notification_type: 'TEST_NOTIFICATION', event: 'test' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            success: true,
            message: 'Test webhook received successfully',
            logId: 101,
        });
        expect(webhookService.updateLogStatus).toHaveBeenCalledWith(101, 'completed', { test: true });
    });
});
