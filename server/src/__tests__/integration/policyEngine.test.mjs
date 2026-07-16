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
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { policyEngine, FORMULA_CONFIDENCE_CAP } = await import('../../services/policyEngine.mjs');
const { policyCandidateRanker } = await import('../../services/policyCandidateRanker.mjs');

describe('PolicyEngine Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let _testPresetId;
    let testMediaServerId;
    let cleanupFixture;

    beforeAll(async () => {
        const fixture = await createPolicyEngineIntegrationFixture(db, {
            mediaServerName: 'Test Media Server',
            mediaServerApiKey: 'test-api-key',
            libraryExternalIdPrefix: 'test-policy-lib',
            libraryName: 'Test Policy Library',
            presetKeyPrefix: 'test_action_movies',
            presetName: 'Test Action Movies',
            presetSignals: {
                genres: { require_any: ['Action'], weight: 1.5 },
                vote_average: { min: 6.0, weight: 0.5 },
            },
            policyName: 'Test Policy',
            policyValues: {
                preset_weight: 0.4,
                profile_weight: 0.0,
                pattern_weight: 0.3,
                rag_weight: 0.2,
                history_weight: 0.1,
            },
            presetLinkWeight: 1.0,
        });

        testMediaServerId = fixture.mediaServerId;
        testLibraryId = fixture.libraryId;
        _testPresetId = fixture.presetId;
        testPolicyId = fixture.policyId;
        cleanupFixture = fixture.cleanup;
    });

    afterAll(async () => {
        await cleanupFixture?.();
    });

    describe('getActivePolicies', () => {
        test('should retrieve active policies with presets', async () => {
            const policies = await policyEngine.getActivePolicies();

            expect(Array.isArray(policies)).toBe(true);
            expect(policies.length).toBeGreaterThan(0);

            const testPolicy = policies.find(p => p.id === testPolicyId);
            expect(testPolicy).toBeDefined();
            expect(testPolicy.name).toBe('Test Policy');
            expect(testPolicy.library_id).toBe(testLibraryId);
            expect(testPolicy.enabled).toBe(true);
            expect(Array.isArray(testPolicy.presets)).toBe(true);
            expect(testPolicy.presets.length).toBeGreaterThan(0);
        });

        test('policy should have correct thresholds and weights', async () => {
            const policies = await policyEngine.getActivePolicies();
            const testPolicy = policies.find(p => p.id === testPolicyId);

            expect(testPolicy.auto_classify_threshold).toBe(85);
            expect(testPolicy.prompt_threshold).toBe(60);
            expect(testPolicy.preset_weight).toBe(0.4);
            expect(testPolicy.pattern_weight).toBe(0.3);
            expect(testPolicy.rag_weight).toBe(0.2);
            expect(testPolicy.history_weight).toBe(0.1);
        });

        test('uses native intent instead of retained legacy presets for converted policy evaluation', async () => {
            const fixture = await createPolicyEngineIntegrationFixture(db, {
                mediaServerName: 'Native Runtime Authority Media Server',
                libraryExternalIdPrefix: 'test-native-runtime-authority',
                libraryName: 'Native Runtime Authority Library',
                presetKeyPrefix: 'test-native-runtime-horror',
                presetName: 'Retained Legacy Horror Preset',
                presetSignals: { genres: { require_any: ['Horror'] } },
                policyName: 'Native Runtime Authority Policy',
                policyValues: {
                    trust_patterns: false,
                    trust_rag: false,
                    trust_history: false,
                    preset_weight: 1,
                    profile_weight: 0,
                    pattern_weight: 0,
                    rag_weight: 0,
                    history_weight: 0,
                },
            });

            try {
                await db.query(`
                    WITH native_intent AS (
                        INSERT INTO policy_intents (
                            policy_id, library_id, schema_version, intent_version,
                            active, source, inference_state, review_behavior, validation_status
                        )
                        VALUES ($1, $2, 1, 1, true, 'native_intent', 'inferred', $3::jsonb, 'valid')
                        RETURNING id
                    ),
                    purpose_rule AS (
                        INSERT INTO policy_intent_rules (
                            intent_id, intent_role, collection, signal_type, operator,
                            values, constraint_mode, semantics, source, inference_state
                        )
                        SELECT id, 'purpose', 'purpose', 'genres', 'require_any',
                            '{"require_any": ["Animation"]}'::jsonb,
                            'advisory', 'identity', 'native_intent', 'inferred'
                        FROM native_intent
                    ),
                    validation_status AS (
                        INSERT INTO policy_intent_validation_status (
                            intent_id, schema_version, status, validator_version,
                            error_count, warning_count, errors, warnings
                        )
                        SELECT id, 1, 'valid', 'native-runtime-test', 0, 0,
                            '[]'::jsonb, '[]'::jsonb
                        FROM native_intent
                    )
                    SELECT id FROM native_intent
                `, [
                    fixture.policyId,
                    fixture.libraryId,
                    JSON.stringify({
                        auto_classify_threshold: 85,
                        prompt_threshold: 60,
                        trust_patterns: false,
                        trust_rag: false,
                        trust_history: false,
                        combination_mode: 'best_match',
                    }),
                ]);
                const policies = await policyEngine.getActivePolicies();
                const nativePolicy = policies.find((policy) => policy.id === fixture.policyId);
                expect(nativePolicy).toEqual(expect.objectContaining({
                    presets: [],
                    policy_runtime_authority: expect.objectContaining({
                        sourceId: 'native_intent',
                        statusId: 'native_intent_active',
                        dependsOnCustomSignals: false,
                    }),
                }));

                const animation = await policyEngine.evaluatePolicy(nativePolicy, {
                    title: 'Animated Feature',
                    genres: ['Animation'],
                    media_type: 'movie',
                });
                const horror = await policyEngine.evaluatePolicy(nativePolicy, {
                    title: 'Horror Feature',
                    genres: ['Horror'],
                    media_type: 'movie',
                });

                expect(animation).toEqual(expect.objectContaining({
                    score: 80,
                    scores: expect.objectContaining({ intent: 80, preset: 0 }),
                    native_intent_runtime: expect.objectContaining({
                        statusId: 'native_intent_runtime_active',
                        eligible: true,
                    }),
                }));
                expect(horror).toEqual(expect.objectContaining({
                    score: 0,
                    scores: expect.objectContaining({ intent: 0, preset: 0 }),
                    native_intent_runtime: expect.objectContaining({
                        statusId: 'native_intent_runtime_purpose_not_matched',
                        eligible: false,
                    }),
                }));
            } finally {
                await fixture.cleanup();
            }
        });

        test('should preserve stored combination_mode and use it in DB-backed evaluation', async () => {
            const comboLibraryRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                VALUES ($1, 'test-combo-lib-' || gen_random_uuid()::text, 'Combination Mode Library', 'movie', true)
                RETURNING id
            `, [testMediaServerId]);
            const comboLibraryId = comboLibraryRes.rows[0].id;

            const actionPresetRes = await db.query(`
                INSERT INTO content_presets (key, name, signals, is_system)
                VALUES (
                    'test_combo_action',
                    'Test Combo Action',
                    '{"genres": {"require_any": ["Action"]}}'::jsonb,
                    false
                )
                RETURNING id
            `);
            const actionPresetId = actionPresetRes.rows[0].id;

            const comedyPresetRes = await db.query(`
                INSERT INTO content_presets (key, name, signals, is_system)
                VALUES (
                    'test_combo_comedy',
                    'Test Combo Comedy',
                    '{"genres": {"require_any": ["Comedy"]}}'::jsonb,
                    false
                )
                RETURNING id
            `);
            const comedyPresetId = comedyPresetRes.rows[0].id;

            const comboPolicyRes = await db.query(`
                INSERT INTO library_policies (
                    library_id,
                    name,
                    enabled,
                    auto_classify_threshold,
                    prompt_threshold,
                    trust_patterns,
                    trust_rag,
                    trust_history,
                    combination_mode,
                    preset_weight,
                    profile_weight,
                    pattern_weight,
                    rag_weight,
                    history_weight
                )
                VALUES ($1, 'Combination Mode Policy', true, 85, 60, false, false, false, 'average', 1.0, 0.0, 0.0, 0.0, 0.0)
                RETURNING id
            `, [comboLibraryId]);
            const comboPolicyId = comboPolicyRes.rows[0].id;

            try {
                await db.query(`
                    INSERT INTO policy_presets (policy_id, preset_id, weight)
                    VALUES ($1, $2, 1.0), ($1, $3, 1.0)
                `, [comboPolicyId, actionPresetId, comedyPresetId]);

                const policies = await policyEngine.getActivePolicies();
                const comboPolicy = policies.find(p => p.id === comboPolicyId);

                expect(comboPolicy).toBeDefined();
                expect(comboPolicy.combination_mode).toBe('average');

                const evaluation = await policyEngine.evaluatePolicy(comboPolicy, {
                    title: 'Action Only',
                    genres: ['Action'],
                    media_type: 'movie'
                });

                expect(evaluation.combination_mode).toBe('average');
                expect(evaluation.scores.preset).toBe(40);
                expect(evaluation.score).toBe(40);
            } finally {
                await db.query('DELETE FROM library_policies WHERE id = $1', [comboPolicyId]);
                await db.query('DELETE FROM content_presets WHERE id = ANY($1::int[])', [[actionPresetId, comedyPresetId]]);
                await db.query('DELETE FROM libraries WHERE id = $1', [comboLibraryId]);
            }
        });
    });

    describe('checkAuthoritativeSignals', () => {
        test('should return null if no source_library_id', async () => {
            const item = {
                title: 'Test Movie',
                media_type: 'movie'
            };

            const result = await policyEngine.checkAuthoritativeSignals(item);
            expect(result).toBeNull();
        });

        test('should match source library if configured', async () => {
            // Update policy with source library ID
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '["test-source-lib-123"]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);

            const item = {
                title: 'Test Movie',
                media_type: 'movie',
                source_library_id: 'test-source-lib-123'
            };

            const result = await policyEngine.checkAuthoritativeSignals(item);

            expect(result).not.toBeNull();
            expect(result.confidence).toBe(100);
            expect(result.method).toBe('authoritative_source_library');
            expect(result.library_id).toBe(testLibraryId);

            // Clean up
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '[]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);
        });
    });

    describe('Signal Scoring Methods', () => {
        test('scoreCertification should handle include mode', () => {
            const config = {
                mode: 'include',
                include: ['PG', 'PG-13']
            };

            const item1 = { certification: 'PG' };
            const item2 = { certification: 'R' };

            expect(policyEngine.scoreCertification(config, item1)).toBe(100);
            expect(policyEngine.scoreCertification(config, item2)).toBe(0);
        });

        test('scoreCertification should handle exclude mode', () => {
            const config = {
                mode: 'exclude',
                exclude: ['R', 'NC-17']
            };

            const item1 = { certification: 'PG' };
            const item2 = { certification: 'R' };

            expect(policyEngine.scoreCertification(config, item1)).toBe(100);
            expect(policyEngine.scoreCertification(config, item2)).toBe(0);
        });

        test('scoreGenres should handle require_any', () => {
            const config = {
                require_any: ['Action', 'Thriller']
            };

            const item1 = { genres: ['Action', 'Comedy'] };
            const item2 = { genres: ['Comedy', 'Drama'] };

            expect(policyEngine.scoreGenres(config, item1)).toBeGreaterThan(0);
            expect(policyEngine.scoreGenres(config, item2)).toBe(0);
        });

        test('scoreGenres should handle exclude', () => {
            const config = {
                require_any: ['Action'],
                exclude: ['Horror']
            };

            const item1 = { genres: ['Action', 'Horror'] };

            expect(policyEngine.scoreGenres(config, item1)).toBe(0);
        });

        test('scoreKeywords should search in keywords and overview', () => {
            const config = {
                require_any: ['superhero']
            };

            const item1 = { keywords: ['superhero', 'marvel'], overview: '' };
            const item2 = { keywords: [], overview: 'A story about a superhero' };
            const item3 = { keywords: [], overview: 'A romantic comedy' };

            expect(policyEngine.scoreKeywords(config, item1)).toBeGreaterThan(0);
            expect(policyEngine.scoreKeywords(config, item2)).toBeGreaterThan(0);
            expect(policyEngine.scoreKeywords(config, item3)).toBe(0);
        });

        test('scoreReleaseYear should handle min/max', () => {
            const config = {
                min: 2000,
                max: 2020
            };

            const item1 = { year: 2010 };
            const item2 = { year: 1990 };
            const item3 = { year: 2025 };

            expect(policyEngine.scoreReleaseYear(config, item1)).toBe(100);
            expect(policyEngine.scoreReleaseYear(config, item2)).toBe(0);
            expect(policyEngine.scoreReleaseYear(config, item3)).toBe(0);
        });

        test('scoreVoteAverage should handle min threshold', () => {
            const config = {
                min: 7.0
            };

            const item1 = { rating: 8.5 };
            const item2 = { rating: 6.0 };

            expect(policyEngine.scoreVoteAverage(config, item1)).toBeGreaterThan(0);
            expect(policyEngine.scoreVoteAverage(config, item2)).toBe(0);
        });

        test('scoreRuntime should handle min/max minutes', () => {
            const config = {
                min_minutes: 90,
                max_minutes: 150
            };

            const item1 = { runtime: 120 };
            const item2 = { runtime: 60 };
            const item3 = { runtime: 180 };

            expect(policyEngine.scoreRuntime(config, item1)).toBe(100);
            expect(policyEngine.scoreRuntime(config, item2)).toBe(0);
            expect(policyEngine.scoreRuntime(config, item3)).toBe(0);
        });

        test('scoreLanguage should handle require_any and exclude', () => {
            const config1 = {
                require_any: ['en', 'es']
            };
            const config2 = {
                exclude: ['en']
            };

            const item = { original_language: 'en' };

            expect(policyEngine.scoreLanguage(config1, item)).toBeGreaterThan(0);
            expect(policyEngine.scoreLanguage(config2, item)).toBe(0);
        });

        test('scoreMediaType should match included types', () => {
            const config = {
                include: ['movie']
            };

            const item1 = { media_type: 'movie' };
            const item2 = { media_type: 'tv' };

            expect(policyEngine.scoreMediaType(config, item1)).toBe(100);
            expect(policyEngine.scoreMediaType(config, item2)).toBe(0);
        });

        test('scoreStudios should return 0 when require_any is set and item has no studio data', () => {
            // Regression test: previously returned 50 (neutral) regardless of require_any,
            // which inflated scores for studio-specific libraries when item lacked studio metadata.
            const config = {
                require_any: ['Disney', 'Pixar']
            };

            // Item with no studios at all
            const itemNoStudios = {};
            expect(policyEngine.scoreStudios(config, itemNoStudios)).toBe(0);

            // Item with empty studios array
            const itemEmptyStudios = { studios: [] };
            expect(policyEngine.scoreStudios(config, itemEmptyStudios)).toBe(0);
        });

        test('scoreStudios should return 50 (neutral) when no require_any and item has no studio data', () => {
            // When there is no explicit studio requirement, missing studio data is neutral —
            // it should not penalise the library.
            const config = {
                prefer: ['Disney']
            };

            const itemNoStudios = {};
            expect(policyEngine.scoreStudios(config, itemNoStudios)).toBe(50);
        });
    });

    describe('evaluatePresetSignals', () => {
        test('should combine multiple signal types with weights', async () => {
            const signals = {
                genres: {
                    require_any: ['Action'],
                    weight: 1.5
                },
                vote_average: {
                    min: 6.0,
                    weight: 0.5
                }
            };

            const item = {
                genres: ['Action', 'Thriller'],
                rating: 7.5
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('should return 0 if media_type does not match', async () => {
            const signals = {
                media_type: {
                    include: ['tv']
                },
                genres: {
                    require_any: ['Action']
                }
            };

            const item = {
                media_type: 'movie',
                genres: ['Action']
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(0);
        });

        test('should treat language require_any as advisory by default when genre matches', async () => {
            // Under preset semantics v2, language.require_any is advisory unless
            // strict: true is explicitly attached. A non-matching language should
            // lower the preset score, not automatically hard-block the preset.
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                language: {
                    require_any: ['ja'],
                    weight: 1.0
                }
            };

            const item = {
                genres: ['Animation', 'Action', 'Fantasy'],
                original_language: 'zh'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('should hard-block preset when strict language require_any fails, even if genre matches', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                language: {
                    require_any: ['ja'],
                    weight: 1.0,
                    strict: true
                }
            };

            const item = {
                genres: ['Animation', 'Action', 'Fantasy'],
                original_language: 'zh'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBe(0);
        });

        test('should pass language require_any when item language matches', async () => {
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                language: {
                    require_any: ['ja'],
                    weight: 1.0
                }
            };

            const item = {
                genres: ['Animation', 'Action'],
                original_language: 'ja'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });

        test('should not hard-block preset when language only has prefer (no require_any)', async () => {
            // language.prefer is a soft signal — non-preferred language should lower score, not block
            const signals = {
                genres: {
                    require_any: ['Animation'],
                    weight: 1.0
                },
                language: {
                    prefer: ['ja'],
                    weight: 1.0
                }
            };

            const item = {
                genres: ['Animation'],
                original_language: 'zh'
            };

            const score = await policyEngine.evaluatePresetSignals(signals, item);
            expect(score).toBeGreaterThan(0);
        });
    });

    describe('scorePresets', () => {
        test('should score item against presets', async () => {
            const presets = [
                {
                    signals: {
                        genres: {
                            require_any: ['Action']
                        }
                    },
                    weight: 1.0
                }
            ];

            const item = {
                genres: ['Action', 'Thriller']
            };

            const score = await policyEngine.scorePresets(presets, item);
            expect(score).toBeGreaterThan(0);
        });

        test('should return 0 for empty presets', async () => {
            const score = await policyEngine.scorePresets([], {});
            expect(score).toBe(0);
        });
    });

    describe('evaluatePolicy', () => {
        test('should evaluate policy with weighted scores', async () => {
            const policy = {
                id: testPolicyId,
                name: 'Test Policy',
                library_id: testLibraryId,
                library_name: 'Test Library',
                auto_classify_threshold: 85,
                prompt_threshold: 60,
                trust_patterns: false,
                trust_rag: false,
                trust_history: false,
                preset_weight: 1.0,
                pattern_weight: 0.0,
                rag_weight: 0.0,
                history_weight: 0.0,
                presets: [
                    {
                        signals: {
                            genres: {
                                require_any: ['Action']
                            }
                        },
                        weight: 1.0
                    }
                ]
            };

            const item = {
                genres: ['Action', 'Thriller']
            };

            const result = await policyEngine.evaluatePolicy(policy, item);

            expect(result).toBeDefined();
            expect(result.policy_id).toBe(testPolicyId);
            expect(result.score).toBeGreaterThan(0);
            expect(result.scores).toBeDefined();
            expect(result.weights).toBeDefined();
        });
    });

    describe('determineAction', () => {
        test('should auto-classify if score meets threshold', () => {
            const ranked = [
                {
                    policy_id: 1,
                    library_id: testLibraryId,
                    library_name: 'Test Library',
                    score: 90,
                    auto_classify_threshold: 85,
                    prompt_threshold: 60
                }
            ];

            const result = policyCandidateRanker.determineAction(ranked);

            expect(result.action).toBe('auto_classify');
            expect(result.confidence).toBe(90);
            expect(result.library).toBeDefined();
        });

        test('should prompt_confirm if score between prompt and auto threshold', () => {
            const ranked = [
                {
                    policy_id: 1,
                    library_id: testLibraryId,
                    library_name: 'Test Library',
                    score: 70,
                    auto_classify_threshold: 85,
                    prompt_threshold: 60
                }
            ];

            const result = policyCandidateRanker.determineAction(ranked);

            expect(result.action).toBe('prompt_confirm');
            expect(result.confidence).toBe(70);
        });

        test('should prompt_select if score below prompt threshold', () => {
            const ranked = [
                {
                    policy_id: 1,
                    library_id: testLibraryId,
                    library_name: 'Test Library',
                    score: 50,
                    auto_classify_threshold: 85,
                    prompt_threshold: 60
                }
            ];

            const result = policyCandidateRanker.determineAction(ranked);

            expect(result.action).toBe('prompt_select');
            expect(result.confidence).toBe(50);
        });

        test('should return manual if score is below the prompt-select floor', () => {
            const ranked = [
                {
                    policy_id: 1,
                    library_id: testLibraryId,
                    library_name: 'Test Library',
                    score: 39,
                    auto_classify_threshold: 85,
                    prompt_threshold: 60
                }
            ];

            const result = policyCandidateRanker.determineAction(ranked);

            expect(result.action).toBe('manual');
            expect(result.confidence).toBe(39);
            expect(result.ranked).toHaveLength(1);
        });

        test('should return manual if no rankings', () => {
            const result = policyCandidateRanker.determineAction([]);

            expect(result.action).toBe('manual');
            expect(result.confidence).toBe(0);
        });
    });

    describe('evaluateItem - End to End', () => {
        test('should evaluate item through full pipeline', async () => {
            const item = {
                title: 'Test Action Movie',
                media_type: 'movie',
                genres: ['Action', 'Thriller'],
                rating: 7.5,
                year: 2020,
                keywords: ['adventure', 'hero'],
                overview: 'An action-packed thriller'
            };

            const result = await policyEngine.evaluateItem(item);

            expect(result).toBeDefined();
            expect(result.action).toBeDefined();
            expect(['auto_classify', 'prompt_confirm', 'prompt_select', 'manual']).toContain(result.action);
            expect(result.confidence).toBeDefined();
            expect(result.ranked).toBeDefined();
            expect(Array.isArray(result.ranked)).toBe(true);
        });

        test('should handle authoritative match', async () => {
            // Update policy with source library
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '["test-auth-lib"]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);

            const item = {
                title: 'Test Movie',
                media_type: 'movie',
                source_library_id: 'test-auth-lib',
                genres: ['Action']
            };

            const result = await policyEngine.evaluateItem(item);

            expect(result.action).toBe('auto_classify');
            expect(result.confidence).toBe(100);
            expect(result.method).toBe('authoritative_source_library');

            // Clean up
            await db.query(`
                UPDATE library_policies
                SET source_library_ids = '[]'::jsonb
                WHERE id = $1
            `, [testPolicyId]);
        });
    });

    describe('rankResults', () => {
        test('should sort evaluations by score descending', async () => {
            const evaluations = [
                { policy_id: 1, score: 50 },
                { policy_id: 2, score: 80 },
                { policy_id: 3, score: 65 }
            ];

            const ranked = await policyCandidateRanker.rankResults(evaluations);

            expect(ranked[0].score).toBe(80);
            expect(ranked[1].score).toBe(65);
            expect(ranked[2].score).toBe(50);
        });

        test('should filter out zero scores', async () => {
            const evaluations = [
                { policy_id: 1, score: 50 },
                { policy_id: 2, score: 0 },
                { policy_id: 3, score: 65 }
            ];

            const ranked = await policyCandidateRanker.rankResults(evaluations);

            expect(ranked.length).toBe(2);
            expect(ranked.find(r => r.score === 0)).toBeUndefined();
        });
    });

    describe('v0.37.0 Verification - Confidence Caps and Default Weights', () => {
        test('FORMULA_CONFIDENCE_CAP should be 95', () => {
            expect(FORMULA_CONFIDENCE_CAP).toBe(95);
        });

        test('Default weights should match v0.37.0 specification', async () => {
            // Create policy without explicit weights to test defaults
            const libRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                VALUES ($1, 'test-default-weights-' || gen_random_uuid()::text, 'Default Weights Test Library', 'movie', true)
                RETURNING id
            `, [testMediaServerId]);
            const defaultWeightsLibId = libRes.rows[0].id;

            const policyRes = await db.query(`
                INSERT INTO library_policies (
                    library_id,
                    name,
                    enabled,
                    auto_classify_threshold,
                    prompt_threshold,
                    trust_patterns,
                    trust_rag,
                    trust_history
                )
                VALUES ($1, 'Default Weights Policy', true, 85, 60, true, true, true)
                RETURNING id
            `, [defaultWeightsLibId]);
            const defaultWeightsPolicyId = policyRes.rows[0].id;

            try {
                const policies = await policyEngine.getActivePolicies();
                const defaultPolicy = policies.find(p => p.id === defaultWeightsPolicyId);

                expect(defaultPolicy).toBeDefined();

                // Test item
                const item = {
                    title: 'Test Movie',
                    genres: ['Action'],
                    media_type: 'movie'
                };

                const evaluation = await policyEngine.evaluatePolicy(defaultPolicy, item);

                // Verify default weights are applied correctly (includes profile_weight)
                expect(evaluation.weights.preset).toBe(0.35);
                expect(evaluation.weights.profile).toBe(0.25);
                expect(evaluation.weights.pattern).toBe(0.15);
                expect(evaluation.weights.rag).toBe(0.15);
                expect(evaluation.weights.history).toBe(0.10);

                // Verify weights sum to 1.0
                const weightSum = evaluation.weights.preset + evaluation.weights.profile +
                    evaluation.weights.pattern + evaluation.weights.rag + evaluation.weights.history;
                expect(weightSum).toBeCloseTo(1.0, 5);
            } finally {
                // Cleanup
                await db.query('DELETE FROM library_policies WHERE id = $1', [defaultWeightsPolicyId]);
                await db.query('DELETE FROM libraries WHERE id = $1', [defaultWeightsLibId]);
            }
        });

        test('scorePresets should cap at FORMULA_CONFIDENCE_CAP (95)', async () => {
            // Create a preset with perfect match signals
            const perfectPresetRes = await db.query(`
                INSERT INTO content_presets (key, name, signals, is_system)
                VALUES (
                    'test_perfect_match',
                    'Test Perfect Match',
                    '{"genres": {"require_any": ["Action"], "weight": 2.0}, "vote_average": {"min": 1.0, "weight": 2.0}}'::jsonb,
                    false
                )
                RETURNING id
            `);
            const perfectPresetId = perfectPresetRes.rows[0].id;

            try {
                const presets = [
                    {
                        id: perfectPresetId,
                        signals: {
                            genres: { require_any: ['Action'], weight: 2.0 },
                            vote_average: { min: 1.0, weight: 2.0 }
                        },
                        weight: 2.0
                    }
                ];

                const item = {
                    genres: ['Action'],
                    rating: 10.0,
                    media_type: 'movie'
                };

                const score = await policyEngine.scorePresets(presets, item);

                // Should be capped at 95, not 100
                expect(score).toBeLessThanOrEqual(95);
                expect(score).toBeGreaterThan(0);
            } finally {
                await db.query('DELETE FROM content_presets WHERE id = $1', [perfectPresetId]);
            }
        });

        test('scorePatterns should cap at FORMULA_CONFIDENCE_CAP (95)', async () => {
            await db.query(`
                UPDATE ai_provider_config
                SET pattern_mining_enabled = true
                WHERE id = 1
            `);

            const patternRes = await db.query(`
                INSERT INTO discovered_patterns (
                    pattern_type,
                    pattern_value,
                    library_id,
                    library_name,
                    confidence,
                    sample_size,
                    support_count,
                    status
                )
                VALUES ('studio', 'Test Studio', $1, 'Test Policy Library', 99.0, 10, 10, 'approved')
                RETURNING id
            `, [testLibraryId]);

            try {
                const score = await policyEngine.scorePatterns(testLibraryId, {
                    studios: ['Test Studio']
                });

                expect(score).toBe(95);
            } finally {
                await db.query('DELETE FROM discovered_patterns WHERE id = $1', [patternRes.rows[0].id]);
            }
        });

        test('scoreHistory should cap at FORMULA_CONFIDENCE_CAP (95)', async () => {
            const tmdbId = 987654;
            const insertedIds = [];

            for (let i = 0; i < 4; i += 1) {
                const result = await db.query(`
                    INSERT INTO classification_history (
                        tmdb_id,
                        media_type,
                        title,
                        library_id,
                        confidence,
                        method,
                        status
                    )
                    VALUES ($1, 'movie', 'History Cap Test', $2, 99, 'ai_analysis', 'completed')
                    RETURNING id
                `, [tmdbId, testLibraryId]);

                insertedIds.push(result.rows[0].id);
            }

            try {
                const score = await policyEngine.scoreHistory(testLibraryId, { tmdb_id: tmdbId });
                expect(score).toBe(95);
            } finally {
                await db.query('DELETE FROM classification_history WHERE id = ANY($1::int[])', [insertedIds]);
            }
        });

        test('Authoritative signals should return 100% confidence (not capped)', async () => {
            // Create library with source_library_id mapping
            const authLibRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                VALUES ($1, 'test-auth-lib-' || gen_random_uuid()::text, 'Auth Test Library', 'movie', true)
                RETURNING id
            `, [testMediaServerId]);
            const authLibId = authLibRes.rows[0].id;

            const authPolicyRes = await db.query(`
                INSERT INTO library_policies (
                    library_id,
                    name,
                    enabled,
                    source_library_ids
                )
                VALUES ($1, 'Auth Policy', true, '["source-123"]'::jsonb)
                RETURNING id
            `, [authLibId]);

            try {
                const item = {
                    title: 'Test Movie',
                    source_library_id: 'source-123',
                    source_library_name: 'Plex Movies'
                };

                const result = await policyEngine.evaluateItem(item);

                // Authoritative signal should return exactly 100%
                expect(result.confidence).toBe(100);
                expect(result.action).toBe('auto_classify');
                expect(result.method).toBe('authoritative_source_library');
            } finally {
                await db.query('DELETE FROM library_policies WHERE id = $1', [authPolicyRes.rows[0].id]);
                await db.query('DELETE FROM libraries WHERE id = $1', [authLibId]);
            }
        });

        test('Formula-based scores should never exceed 95%', async () => {
            // Create a dedicated library for this test
            const libRes = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                VALUES ($1, 'test-high-score-lib-' || gen_random_uuid()::text, 'High Score Test Library', 'movie', true)
                RETURNING id
            `, [testMediaServerId]);
            const highScoreLibId = libRes.rows[0].id;

            // Create multiple high-scoring presets
            const highPresetRes = await db.query(`
                INSERT INTO content_presets (key, name, signals, is_system)
                VALUES (
                    'test_high_score',
                    'Test High Score',
                    '{"genres": {"require_any": ["Action", "Adventure"], "weight": 1.5}}'::jsonb,
                    false
                )
                RETURNING id
            `);
            const highPresetId = highPresetRes.rows[0].id;

            const highPolicyRes = await db.query(`
                INSERT INTO library_policies (
                    library_id,
                    name,
                    enabled,
                    auto_classify_threshold,
                    prompt_threshold
                )
                VALUES ($1, 'High Score Policy', true, 85, 60)
                RETURNING id
            `, [highScoreLibId]);
            const highPolicyId = highPolicyRes.rows[0].id;

            await db.query(`
                INSERT INTO policy_presets (policy_id, preset_id, weight)
                VALUES ($1, $2, 2.0)
            `, [highPolicyId, highPresetId]);

            try {
                const item = {
                    title: 'Perfect Match Movie',
                    genres: ['Action', 'Adventure'],
                    keywords: ['superhero', 'marvel'],
                    rating: 9.5,
                    media_type: 'movie'
                };

                const result = await policyEngine.evaluateItem(item);

                // Even with perfect matches, formula score should not exceed 95%
                if (result.confidence > 0 && result.method !== 'authoritative_source_library') {
                    expect(result.confidence).toBeLessThanOrEqual(95);
                }
            } finally {
                await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [highPolicyId]);
                await db.query('DELETE FROM library_policies WHERE id = $1', [highPolicyId]);
                await db.query('DELETE FROM content_presets WHERE id = $1', [highPresetId]);
                await db.query('DELETE FROM libraries WHERE id = $1', [highScoreLibId]);
            }
        });
    });
});
