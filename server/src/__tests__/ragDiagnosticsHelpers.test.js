/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const express = require('express');
const request = require('supertest');
const { createRagDiagnosticsHelpers, registerRagDiagnosticsRoutes } = require('../routes/helpers/ragDiagnosticsHelpers');

describe('ragDiagnosticsHelpers', () => {
    const buildHelpers = (overrides = {}) => createRagDiagnosticsHelpers({
        db: {
            query: jest.fn()
        },
        logger: {
            error: jest.fn()
        },
        embeddingRouter: {
            getCircuitStatus: jest.fn(() => ({ state: 'OPEN' })),
            getCircuitStateHistory: jest.fn(() => [{ state: 'CLOSED' }, { state: 'OPEN' }]),
            resetCircuit: jest.fn()
        },
        embeddingProvider: {
            warmup: jest.fn().mockResolvedValue({ provider: 'ollama', model: 'mxbai-embed-large' })
        },
        embeddingMigrationService: {
            getProgress: jest.fn(() => ({ running: false })),
            markAllForReembedding: jest.fn().mockResolvedValue(undefined),
            startBackgroundMigration: jest.fn().mockResolvedValue(undefined)
        },
        patternMiningService: {
            getPatternsSummary: jest.fn().mockResolvedValue({ approved: 3 }),
            discoverPatterns: jest.fn().mockResolvedValue({ success: true, discovered: 4 })
        },
        ragLoopMetricsCollector: {
            canPromote: jest.fn(() => ({
                ready: true,
                metrics: { samples: 12 }
            }))
        },
        ragLogger: {
            getRecentErrors: jest.fn().mockResolvedValue([{ message: 'boom' }])
        },
        getRagLoopDefaultConfig: jest.fn(() => ({
            rag_loop_rollout_mode: 'shadow',
            rag_loop_auto_fallback_enabled: true,
            rag_loop_auto_recover_enabled: true,
            rag_loop_shadow_min_samples: 10,
            rag_loop_shadow_max_error_rate_delta: 0.05,
            rag_loop_shadow_max_p95_latency_delta_ms: 250
        })),
        validateAndNormalizeRagLoopConfig: jest.fn((merged) => ({
            normalizedConfig: merged
        })),
        ...overrides
    });

    test('getLatestFallbackIncidentPayload backfills incident id and trigger time from config row', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({
                rows: [{
                    rag_loop_rollout_mode: 'shadow',
                    rag_loop_auto_fallback_enabled: true,
                    rag_loop_auto_recover_enabled: false,
                    rag_loop_auto_fallback_breach_count: '2',
                    rag_loop_auto_fallback_cooldown_until: '2026-03-28T01:00:00.000Z',
                    rag_loop_auto_fallback_last_triggered_at: '2026-03-28T00:55:00.000Z',
                    rag_loop_auto_fallback_last_incident_id: 'incident-1',
                    rag_loop_auto_fallback_last_incident_payload: { reason: 'p95_latency' },
                    rag_loop_auto_fallback_last_version: 'v1',
                    rag_loop_auto_recover_last_attempt_version: 'v2',
                    rag_loop_auto_recover_last_attempt_at: '2026-03-28T00:57:00.000Z'
                }]
            })
        };
        const helpers = buildHelpers({ db });

        const payload = await helpers.getLatestFallbackIncidentPayload();

        expect(payload).toMatchObject({
            rollout_mode: 'shadow',
            incident: {
                incident_id: 'incident-1',
                triggered_at: '2026-03-28T00:55:00.000Z',
                reason: 'p95_latency'
            },
            fallback_state: {
                auto_fallback_enabled: true,
                auto_recover_enabled: false,
                breach_count: 2,
                cooldown_until: '2026-03-28T01:00:00.000Z',
                last_fallback_version: 'v1',
                last_recover_attempt_version: 'v2',
                last_recover_attempt_at: '2026-03-28T00:57:00.000Z'
            }
        });
        expect(payload.checked_at).toEqual(expect.any(String));
    });

    test('getPromotionReadinessPayload returns readiness metrics with normalized gates', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({
                rows: [{
                    rag_loop_shadow_min_samples: 25,
                    rag_loop_shadow_max_error_rate_delta: 0.02,
                    rag_loop_shadow_max_p95_latency_delta_ms: 150
                }]
            })
        };
        const helpers = buildHelpers({ db });

        const payload = await helpers.getPromotionReadinessPayload();

        expect(payload).toMatchObject({
            ready: true,
            metrics: { samples: 12 },
            gates: {
                min_samples: 25,
                max_error_rate_delta: 0.02,
                max_p95_latency_delta_ms: 150
            }
        });
    });

    test('approvePattern throws 404 when the pattern is missing', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({ rows: [] })
        };
        const helpers = buildHelpers({ db });

        await expect(helpers.approvePattern({ id: 42, approvedBy: 'user' }))
            .rejects
            .toMatchObject({ status: 404, message: 'Pattern not found' });
    });

    test('getGraphFillRatePayload calculates percentages from classification history counts', async () => {
        const db = {
            query: jest.fn().mockResolvedValue({
                rows: [{
                    total: '20',
                    has_director: '10',
                    has_studio: '8',
                    has_genres: '15',
                    has_cast: '5',
                    has_collection: '4'
                }]
            })
        };
        const helpers = buildHelpers({ db });

        const payload = await helpers.getGraphFillRatePayload();

        expect(payload).toEqual({
            total: 20,
            has_director: 10,
            has_studio: 8,
            has_genres: 15,
            has_cast: 5,
            has_collection: 4,
            pct_director: 50,
            pct_studio: 40,
            pct_genres: 75,
            pct_cast: 25,
            pct_collection: 20
        });
    });

    test('startMigration logs background failures without failing the start response', async () => {
        const logger = { error: jest.fn() };
        const embeddingMigrationService = {
            getProgress: jest.fn(() => ({ running: true })),
            markAllForReembedding: jest.fn().mockResolvedValue(undefined),
            startBackgroundMigration: jest.fn().mockRejectedValue(new Error('background failed'))
        };
        const helpers = buildHelpers({ logger, embeddingMigrationService });

        const payload = await helpers.startMigration({ markAllStale: true });
        await new Promise(process.nextTick);

        expect(embeddingMigrationService.markAllForReembedding).toHaveBeenCalled();
        expect(payload).toEqual({
            success: true,
            message: 'Migration started in background',
            progress: { running: true }
        });
        expect(logger.error).toHaveBeenCalledWith('Background migration error', {
            error: 'background failed'
        });
    });

    test('getLatestFallbackIncidentPayload tolerates missing rag loop columns during rollout bootstrap', async () => {
        const db = {
            query: jest.fn().mockRejectedValue(Object.assign(new Error('missing column'), { code: '42703' }))
        };
        const helpers = buildHelpers({ db });

        const payload = await helpers.getLatestFallbackIncidentPayload();

        expect(payload.incident).toBeNull();
        expect(payload.rollout_mode).toBe('shadow');
        expect(payload.fallback_state.auto_fallback_enabled).toBe(true);
        expect(payload.fallback_state.breach_count).toBe(0);
    });

    test('registerRagDiagnosticsRoutes covers success, 404, and 500 response paths', async () => {
        const logger = {
            error: jest.fn()
        };
        const helpers = {
            approvePattern: jest.fn()
                .mockResolvedValueOnce({ pattern: { id: 1 } })
                .mockRejectedValueOnce(Object.assign(new Error('missing approve'), { status: 404 })),
            discoverPatterns: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('discover failed')),
            getCircuitBreakerPayload: jest.fn()
                .mockReturnValueOnce({ state: 'OPEN' })
                .mockImplementationOnce(() => {
                    throw new Error('breaker failed');
                }),
            getErrorsPayload: jest.fn()
                .mockResolvedValueOnce({ errors: [] })
                .mockRejectedValueOnce(new Error('errors failed')),
            getGraphFillRatePayload: jest.fn()
                .mockResolvedValueOnce({ total: 0 })
                .mockRejectedValueOnce(new Error('graph failed')),
            getLatestFallbackIncidentPayload: jest.fn()
                .mockResolvedValueOnce({ incident: null })
                .mockRejectedValueOnce(new Error('fallback failed')),
            getMigrationStatus: jest.fn()
                .mockResolvedValueOnce({ running: false })
                .mockRejectedValueOnce(new Error('migration status failed')),
            getPatternsPayload: jest.fn()
                .mockResolvedValueOnce({ patterns: [] })
                .mockRejectedValueOnce(new Error('patterns failed')),
            getPromotionReadinessPayload: jest.fn()
                .mockResolvedValueOnce({ ready: true })
                .mockRejectedValueOnce(new Error('promotion failed')),
            rejectPattern: jest.fn()
                .mockResolvedValueOnce({ pattern: { id: 2 } })
                .mockRejectedValueOnce(Object.assign(new Error('missing reject'), { status: 404 })),
            resetCircuitBreaker: jest.fn()
                .mockReturnValueOnce({ success: true })
                .mockImplementationOnce(() => {
                    throw new Error('reset failed');
                }),
            startMigration: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('start failed')),
            warmup: jest.fn()
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('warmup failed'))
        };

        const app = express();
        const router = express.Router();
        app.use(express.json());
        registerRagDiagnosticsRoutes({ router, logger, helpers });
        app.use('/rag', router);

        await request(app).get('/rag/loop/latest-fallback-incident').expect(200, { incident: null });
        await request(app).get('/rag/loop/latest-fallback-incident').expect(500, { error: 'fallback failed' });

        await request(app).get('/rag/loop/promotion-readiness').expect(200, { ready: true });
        await request(app).get('/rag/loop/promotion-readiness').expect(500, { error: 'promotion failed' });

        await request(app).get('/rag/circuit-breaker').expect(200, { state: 'OPEN' });
        await request(app).get('/rag/circuit-breaker').expect(500, { error: 'breaker failed' });

        await request(app).post('/rag/circuit-breaker/reset').expect(200, { success: true });
        await request(app).post('/rag/circuit-breaker/reset').expect(500, { error: 'reset failed' });

        await request(app).post('/rag/warmup').expect(200, { success: true });
        await request(app).post('/rag/warmup').expect(500, { success: false, error: 'warmup failed' });

        await request(app).get('/rag/errors').expect(200, { errors: [] });
        await request(app).get('/rag/errors').expect(500, { error: 'errors failed' });

        await request(app).get('/rag/migration/status').expect(200, { running: false });
        await request(app).get('/rag/migration/status').expect(500, { error: 'migration status failed' });

        await request(app).post('/rag/migration/start').send({}).expect(200, { success: true });
        await request(app).post('/rag/migration/start').send({}).expect(500, { error: 'start failed' });

        await request(app).get('/rag/patterns').expect(200, { patterns: [] });
        await request(app).get('/rag/patterns').expect(500, { error: 'patterns failed' });

        await request(app).post('/rag/patterns/discover').expect(200, { success: true });
        await request(app).post('/rag/patterns/discover').expect(500, { error: 'discover failed' });

        await request(app).put('/rag/patterns/1/approve').send({ approvedBy: 'me' }).expect(200, { pattern: { id: 1 } });
        await request(app).put('/rag/patterns/1/approve').send({ approvedBy: 'me' }).expect(404, { error: 'missing approve' });

        await request(app).put('/rag/patterns/2/reject').send({ rejectedBy: 'me' }).expect(200, { pattern: { id: 2 } });
        await request(app).put('/rag/patterns/2/reject').send({ rejectedBy: 'me' }).expect(404, { error: 'missing reject' });

        await request(app).get('/rag/graph/fill-rate').expect(200, { total: 0 });
        await request(app).get('/rag/graph/fill-rate').expect(500, { error: 'graph failed' });

        expect(logger.error).toHaveBeenCalledWith('Failed to get rag loop latest fallback incident', { error: 'fallback failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get rag loop promotion readiness', { error: 'promotion failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get circuit breaker status', { error: 'breaker failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to reset circuit breaker', { error: 'reset failed' });
        expect(logger.error).toHaveBeenCalledWith('Model warmup failed', { error: 'warmup failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get RAG errors', { error: 'errors failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get migration status', { error: 'migration status failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to start migration', { error: 'start failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get patterns', { error: 'patterns failed' });
        expect(logger.error).toHaveBeenCalledWith('Pattern discovery failed', { error: 'discover failed' });
        expect(logger.error).toHaveBeenCalledWith('Failed to approve pattern', { error: 'missing approve' });
        expect(logger.error).toHaveBeenCalledWith('Failed to reject pattern', { error: 'missing reject' });
        expect(logger.error).toHaveBeenCalledWith('Failed to get graph fill-rate', { error: 'graph failed' });
    });
});
