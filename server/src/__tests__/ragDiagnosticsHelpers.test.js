/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { createRagDiagnosticsHelpers } = require('../routes/helpers/ragDiagnosticsHelpers');

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
});
