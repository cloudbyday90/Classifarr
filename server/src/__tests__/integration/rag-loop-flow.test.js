/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const setup = require('./setup');
jest.setTimeout(300000);

jest.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

jest.mock('../../services/policyEngine', () => ({
    evaluateItem: jest.fn()
}));

jest.mock('../../services/ragRetriever', () => ({
    semanticSearchCandidates: jest.fn(),
    semanticSearch: jest.fn(),
    hybridSearch: jest.fn(),
    getSuggestedLibrary: jest.fn()
}));

const classificationService = require('../../services/classification');
const classificationRagLoopService = require('../../services/classificationRagLoopService');
const policyEngine = require('../../services/policyEngine');
const ragRetriever = require('../../services/ragRetriever');
const ragLoopResilienceManager = require('../../services/ragLoopResilienceManager');
const rootPackage = require('../../../../package.json');

describe('Issue 275 rag loop integration flows', () => {
    let pool;

    beforeAll(() => {
        pool = setup.getPool();
    });

    beforeEach(async () => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        ragLoopResilienceManager.reset();

        await pool.query('TRUNCATE TABLE classification_history RESTART IDENTITY CASCADE');
        await pool.query(`
            INSERT INTO ai_provider_config (id, primary_provider)
            VALUES (1, 'none')
            ON CONFLICT (id) DO NOTHING
        `);
        await pool.query(`
            UPDATE ai_provider_config
            SET rag_retrieval_loop_enabled = true,
                rag_loop_rollout_mode = 'apply',
                rag_loop_auto_fallback_enabled = true,
                rag_loop_auto_fallback_min_apply_samples = 25,
                rag_loop_auto_fallback_consecutive_breaches = 3,
                rag_loop_auto_fallback_cooldown_ms = 900000,
                rag_loop_auto_recover_enabled = false,
                rag_loop_auto_fallback_breach_count = 0,
                rag_loop_auto_fallback_last_incident_id = NULL,
                rag_loop_auto_fallback_last_incident_payload = NULL,
                rag_loop_auto_fallback_last_triggered_at = NULL,
                rag_loop_auto_fallback_last_version = NULL,
                rag_loop_auto_recover_last_attempt_version = NULL,
                rag_loop_auto_recover_last_attempt_at = NULL,
                policy_recheck_max_ai_calls_per_item = 1
            WHERE id = 1
        `);

        ragRetriever.semanticSearchCandidates.mockResolvedValue([
            { libraryId: 1, libraryName: 'Movies', similarity: 0.62 },
            { libraryId: 2, libraryName: 'Family', similarity: 0.60 }
        ]);
        ragRetriever.hybridSearch.mockResolvedValue([
            { libraryId: 2, libraryName: 'Family', similarity: 0.75 },
            { libraryId: 2, libraryName: 'Family', similarity: 0.72 }
        ]);
        ragRetriever.semanticSearch.mockResolvedValue([
            { libraryId: 2, libraryName: 'Family', similarity: 0.75 },
            { libraryId: 2, libraryName: 'Family', similarity: 0.72 }
        ]);
        ragRetriever.getSuggestedLibrary.mockReturnValue({
            libraryId: 2,
            libraryName: 'Family',
            voteCount: 2,
            avgSimilarity: 0.73
        });
    });

    const buildConfig = (rolloutMode) => ({
        rag_retrieval_loop_enabled: true,
        rag_loop_rollout_mode: rolloutMode,
        rag_loop_trace_enabled: true,
        rag_loop_trace_max_events: 20,
        rag_loop_trace_max_bytes: 16384,
        rag_loop_conflict_detection_enabled: true,
        rag_conflict_top_n: 5,
        rag_loop_candidate_limit: 25,
        rag_retry_strategy: 'hybrid',
        policy_recheck_below_prompt_threshold_enabled: true,
        policy_recheck_identifier_caps: {
            keywords: 8,
            genres: 5,
            studios: 3,
            cast: 3
        },
        policy_recheck_min_similarity_delta: 0.08,
        policy_recheck_min_margin_delta: 10,
        policy_recheck_min_confidence_gain: 5,
        policy_recheck_max_ai_calls_per_item: 1,
        policy_recheck_metadata_enrichment_enabled: false,
        policy_recheck_metadata_timeout_ms: 2000,
        rag_loop_resilience_enabled: true,
        rag_loop_resilience_window_ms: 60000,
        rag_loop_resilience_min_samples: 3,
        rag_loop_resilience_timeout_streak_threshold: 2,
        rag_loop_resilience_timeout_rate_threshold: 0.5,
        rag_loop_resilience_error_rate_threshold: 0.5,
        rag_loop_cooldown_tmdb_ms: 60000,
        rag_loop_cooldown_rag_ms: 60000,
        rag_loop_cooldown_ai_ms: 60000,
        rag_loop_half_open_probe_count: 2,
        rag_loop_global_bypass_multi_open_enabled: true,
        rag_loop_global_bypass_ms: 60000
    });

    const inputFixture = () => ({
        metadata: {
            tmdb_id: 1001,
            media_type: 'movie',
            title: 'Ambiguous Family Title',
            genres: ['Drama'],
            keywords: ['family']
        },
        libraries: [
            { id: 1, name: 'Movies' },
            { id: 2, name: 'Family' }
        ],
        baselineResult: {
            library: { id: 1, name: 'Movies' },
            confidence: 58,
            method: 'ai_analysis',
            needs_clarification: false
        },
        policyResult: {
            action: 'prompt_select',
            confidence: 54,
            ranked: [{
                library_id: 1,
                library_name: 'Movies',
                score: 54,
                prompt_threshold: 60,
                auto_classify_threshold: 85
            }]
        },
        signalContext: { confidence: 58 },
        ragContext: {
            similarItems: [{ libraryId: 1, libraryName: 'Movies', similarity: 0.61 }]
        }
    });

    test('policy-first targeted re-check upgrades decision in apply mode for ambiguous item', async () => {
        jest.spyOn(classificationService, 'getRagLoopConfig').mockResolvedValue(buildConfig('apply'));
        policyEngine.evaluateItem.mockResolvedValue({
            action: 'prompt_confirm',
            confidence: 74,
            library: {
                library_id: 2,
                library_name: 'Family',
                policy_id: 99,
                policy_name: 'Family Policy'
            },
            ranked: [
                {
                    library_id: 2,
                    library_name: 'Family',
                    score: 74,
                    prompt_threshold: 60,
                    auto_classify_threshold: 85
                }
            ]
        });

        const result = await classificationService.evaluateRagLoopSecondPass(inputFixture());

        expect(result.library.id).toBe(2);
        expect(result.method).toBe('policy_recheck');
        expect(result.ragLoopTrace).toBeTruthy();
        expect(result.ragLoopTrace.mode).toBe('apply');
        expect(result.ragLoopTrace.trigger).toBe('policy_prompt_select');
    });

    test('identical input yields parity diagnostics while apply can diverge in final adoption', async () => {
        policyEngine.evaluateItem.mockResolvedValue({
            action: 'prompt_confirm',
            confidence: 74,
            library: {
                library_id: 2,
                library_name: 'Family',
                policy_id: 99,
                policy_name: 'Family Policy'
            },
            ranked: [
                {
                    library_id: 2,
                    library_name: 'Family',
                    score: 74,
                    prompt_threshold: 60,
                    auto_classify_threshold: 85
                }
            ]
        });

        jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValueOnce(buildConfig('shadow'));
        const shadowResult = await classificationService.evaluateRagLoopSecondPass(inputFixture());

        jest.spyOn(classificationRagLoopService, 'getRagLoopConfig').mockResolvedValueOnce(buildConfig('apply'));
        const applyResult = await classificationService.evaluateRagLoopSecondPass(inputFixture());

        expect(shadowResult.library.id).toBe(1);
        expect(applyResult.library.id).toBe(2);
        expect(shadowResult.ragLoopTrace.trigger).toBe(applyResult.ragLoopTrace.trigger);
        expect(shadowResult.ragLoopTrace.strategy).toBe(applyResult.ragLoopTrace.strategy);
        expect(shadowResult.ragLoopTrace.diagnostics.pass1.top_similarity)
            .toBe(applyResult.ragLoopTrace.diagnostics.pass1.top_similarity);
    });

    test('logClassification persists rag_loop_trace for audit read compatibility', async () => {
        const metadata = {
            tmdb_id: 2002,
            media_type: 'movie',
            title: 'Trace Persistence Sample',
            year: 2025
        };
        const trace = {
            trace_version: 1,
            mode: 'shadow',
            ran: true,
            trigger: 'policy_prompt_select',
            strategy: 'hybrid',
            diagnostics: {
                pass1: { match_count: 2, top_similarity: 0.55, margin_points: 8 },
                pass2: { match_count: 3, top_similarity: 0.68, margin_points: 14 }
            },
            decision: {
                outcome: 'baseline',
                reason: 'no_change',
                comparator: 'confidence_gain_below_gate'
            },
            events: [
                { stage: 'gate', outcome: 'run', reason_code: 'policy_prompt_select' }
            ]
        };

        const classificationId = await classificationService.logClassification(
            metadata,
            {
                confidence: 58,
                method: 'ai_analysis',
                reason: 'Awaiting user confirmation',
                needs_clarification: true,
                pending_reason: 'Policy uncertainty',
                ragLoopTrace: trace
            },
            Date.now()
        );

        const persisted = await pool.query(
            `SELECT metadata->'classification_details'->'rag_loop_trace' AS rag_loop_trace
             FROM classification_history
             WHERE id = $1`,
            [classificationId]
        );

        expect(persisted.rows).toHaveLength(1);
        expect(persisted.rows[0].rag_loop_trace).toBeTruthy();
        expect(persisted.rows[0].rag_loop_trace.trace_version).toBe(1);
        expect(persisted.rows[0].rag_loop_trace.mode).toBe('shadow');
    });

    test('apply-mode sustained regression can auto-switch rollout mode to shadow and persist incident payload', async () => {
        await pool.query(`
            UPDATE ai_provider_config
            SET rag_loop_rollout_mode = 'apply',
                rag_loop_auto_fallback_enabled = true,
                rag_loop_auto_fallback_min_apply_samples = 1,
                rag_loop_auto_fallback_consecutive_breaches = 1,
                rag_loop_shadow_max_error_rate_delta = 0.0,
                rag_loop_shadow_max_p95_latency_delta_ms = 0,
                policy_recheck_max_ai_calls_per_item = 1
            WHERE id = 1
        `);

        ragRetriever.semanticSearchCandidates.mockRejectedValueOnce(new Error('forced pass1 candidate error'));
        policyEngine.evaluateItem.mockResolvedValue({
            action: 'prompt_select',
            confidence: 54,
            ranked: [
                {
                    library_id: 1,
                    library_name: 'Movies',
                    score: 54,
                    prompt_threshold: 60,
                    auto_classify_threshold: 85
                }
            ]
        });

        await classificationService.evaluateRagLoopSecondPass(inputFixture());

        const result = await pool.query(`
            SELECT
              rag_loop_rollout_mode,
              rag_loop_auto_fallback_last_incident_id,
              rag_loop_auto_fallback_last_incident_payload
            FROM ai_provider_config
            WHERE id = 1
        `);

        expect(result.rows[0].rag_loop_rollout_mode).toBe('shadow');
        expect(result.rows[0].rag_loop_auto_fallback_last_incident_id).toBeTruthy();
        expect(result.rows[0].rag_loop_auto_fallback_last_incident_payload).toBeTruthy();
        expect(result.rows[0].rag_loop_auto_fallback_last_incident_payload.to_mode).toBe('shadow');
    });

    test('disabled auto-fallback does not auto-switch mode under same regression conditions', async () => {
        await pool.query(`
            UPDATE ai_provider_config
            SET rag_loop_rollout_mode = 'apply',
                rag_loop_auto_fallback_enabled = false,
                rag_loop_auto_fallback_min_apply_samples = 1,
                rag_loop_auto_fallback_consecutive_breaches = 1,
                rag_loop_shadow_max_error_rate_delta = 0.0,
                rag_loop_shadow_max_p95_latency_delta_ms = 0,
                policy_recheck_max_ai_calls_per_item = 1
            WHERE id = 1
        `);

        ragRetriever.semanticSearchCandidates.mockRejectedValueOnce(new Error('forced pass1 candidate error'));
        policyEngine.evaluateItem.mockResolvedValue({
            action: 'prompt_select',
            confidence: 54,
            ranked: [
                {
                    library_id: 1,
                    library_name: 'Movies',
                    score: 54,
                    prompt_threshold: 60,
                    auto_classify_threshold: 85
                }
            ]
        });

        await classificationService.evaluateRagLoopSecondPass(inputFixture());

        const result = await pool.query(`
            SELECT rag_loop_rollout_mode, rag_loop_auto_fallback_last_incident_id
            FROM ai_provider_config
            WHERE id = 1
        `);

        expect(result.rows[0].rag_loop_rollout_mode).toBe('apply');
        expect(result.rows[0].rag_loop_auto_fallback_last_incident_id).toBeNull();
    });

    test('auto-recover can re-enable apply once on version bump when toggle is enabled', async () => {
        await pool.query(`
            UPDATE ai_provider_config
            SET rag_loop_rollout_mode = 'shadow',
                rag_loop_auto_recover_enabled = true,
                rag_loop_auto_fallback_last_version = '0.40.0-alpha',
                rag_loop_auto_recover_last_attempt_version = NULL
            WHERE id = 1
        `);

        const baselineResult = {
            library: { id: 1, name: 'Movies' },
            confidence: 92,
            method: 'ai_analysis',
            needs_clarification: false
        };
        const policyResult = {
            action: 'auto_classify',
            confidence: 92,
            ranked: [{
                library_id: 1,
                library_name: 'Movies',
                score: 92,
                prompt_threshold: 60,
                auto_classify_threshold: 85
            }]
        };

        await classificationService.evaluateRagLoopSecondPass({
            metadata: {
                tmdb_id: 3001,
                media_type: 'movie',
                title: 'Recover Candidate',
                genres: ['Drama'],
                keywords: ['family']
            },
            libraries: [
                { id: 1, name: 'Movies' },
                { id: 2, name: 'Family' }
            ],
            baselineResult,
            policyResult,
            signalContext: { confidence: 92 },
            ragContext: null
        });

        const result = await pool.query(`
            SELECT
              rag_loop_rollout_mode,
              rag_loop_auto_recover_last_attempt_version
            FROM ai_provider_config
            WHERE id = 1
        `);

        expect(result.rows[0].rag_loop_rollout_mode).toBe('apply');
        expect(result.rows[0].rag_loop_auto_recover_last_attempt_version).toBe(rootPackage.version);
    });
});
