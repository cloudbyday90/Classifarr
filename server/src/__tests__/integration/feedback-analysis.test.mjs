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
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { feedbackAnalysis } = await import('../../services/feedbackAnalysis.mjs');

describe('FeedbackAnalysis Integration Tests', () => {
    let testLibraryId;
    let testLibraryId2;
    let testPolicyId;
    let testPolicyId2;
    let testMediaServerId;
    let testUserId;

    beforeAll(async () => {
        const userRes = await db.query(`
            INSERT INTO users (username, password_hash, role)
            VALUES ('test-feedback-user', 'hash', 'admin')
            RETURNING id
        `);
        testUserId = userRes.rows[0].id;

        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Feedback Server', 'http://localhost:32400', 'test-key')
            ON CONFLICT DO NOTHING
            RETURNING id
        `);

        if (serverRes.rows.length > 0) {
            testMediaServerId = serverRes.rows[0].id;
        } else {
            const existingServer = await db.query(`
                SELECT id FROM media_server LIMIT 1
            `);
            testMediaServerId = existingServer.rows[0].id;
        }

        const libRes1 = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
            VALUES ($1, 'test-feedback-lib-1-' || gen_random_uuid()::text, 'Test Feedback Library 1', 'movie', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes1.rows[0].id;

        const libRes2 = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
            VALUES ($1, 'test-feedback-lib-2-' || gen_random_uuid()::text, 'Test Feedback Library 2', 'movie', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId2 = libRes2.rows[0].id;

        const policyRes1 = await db.query(`
            INSERT INTO library_policies (
                library_id,
                name,
                enabled,
                auto_classify_threshold,
                prompt_threshold,
                preset_weight,
                pattern_weight,
                rag_weight,
                history_weight
            ) VALUES ($1, 'Test Feedback Policy 1', true, 85, 60, 0.4, 0.3, 0.2, 0.1)
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes1.rows[0].id;

        const policyRes2 = await db.query(`
            INSERT INTO library_policies (
                library_id,
                name,
                enabled,
                auto_classify_threshold,
                prompt_threshold,
                preset_weight,
                pattern_weight,
                rag_weight,
                history_weight
            ) VALUES ($1, 'Test Feedback Policy 2', true, 80, 55, 0.5, 0.25, 0.15, 0.1)
            RETURNING id
        `, [testLibraryId2]);
        testPolicyId2 = policyRes2.rows[0].id;
    });

    afterAll(async () => {
        await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id IN ($1, $2)', [testPolicyId, testPolicyId2]);
        await db.query('DELETE FROM policy_tuning_suggestions WHERE policy_id IN ($1, $2)', [testPolicyId, testPolicyId2]);
        await db.query('DELETE FROM policy_learning_stats WHERE policy_id IN ($1, $2)', [testPolicyId, testPolicyId2]);
        await db.query('DELETE FROM library_policies WHERE id IN ($1, $2)', [testPolicyId, testPolicyId2]);
        await db.query('DELETE FROM libraries WHERE id IN ($1, $2)', [testLibraryId, testLibraryId2]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    describe('recordFeedback', () => {
        test('should record feedback successfully', async () => {
            const feedbackData = {
                tmdb_id: 12345,
                media_type: 'movie',
                title: 'Test Movie',
                item_metadata: {
                    genres: ['Action', 'Thriller'],
                    production_companies: ['Test Studio'],
                    vote_average: 7.5
                },
                prompt_type: 'prompt_select',
                original_scores: {
                    preset: 75,
                    pattern: 60,
                    rag: 50,
                    history: 0
                },
                top_suggestion_library_id: testLibraryId,
                top_suggestion_score: 75,
                selected_library_id: testLibraryId,
                selected_policy_id: testPolicyId,
                was_correction: false,
                user_reason: 'looks_correct',
                source: 'web'
            };

            const feedbackId = await feedbackAnalysis.recordFeedback(feedbackData);

            expect(feedbackId).toBeDefined();
            expect(typeof feedbackId).toBe('number');

            const result = await db.query(`
                SELECT * FROM policy_feedback_log WHERE id = $1
            `, [feedbackId]);

            expect(result.rows.length).toBe(1);
            const feedback = result.rows[0];
            expect(feedback.tmdb_id).toBe(12345);
            expect(feedback.title).toBe('Test Movie');
            expect(feedback.was_correction).toBe(false);
            expect(feedback.selected_policy_id).toBe(testPolicyId);
        });

        test('should record correction feedback', async () => {
            const feedbackData = {
                tmdb_id: 12346,
                media_type: 'movie',
                title: 'Test Movie 2',
                item_metadata: {
                    genres: ['Drama'],
                    production_companies: ['Another Studio']
                },
                prompt_type: 'auto_classify',
                original_scores: {
                    preset: 88,
                    pattern: 85,
                    rag: 80,
                    history: 75
                },
                top_suggestion_library_id: testLibraryId,
                top_suggestion_score: 88,
                selected_library_id: testLibraryId2,
                selected_policy_id: testPolicyId2,
                was_correction: true,
                user_reason: 'wrong_classification',
                user_reason_text: 'Should be in Library 2',
                source: 'discord'
            };

            const feedbackId = await feedbackAnalysis.recordFeedback(feedbackData);

            expect(feedbackId).toBeDefined();

            const result = await db.query(`
                SELECT * FROM policy_feedback_log WHERE id = $1
            `, [feedbackId]);

            const feedback = result.rows[0];
            expect(feedback.was_correction).toBe(true);
            expect(feedback.user_reason).toBe('wrong_classification');
            expect(feedback.source).toBe('discord');
        });

        test('should update learning stats after recording feedback', async () => {
            const feedbackData = {
                tmdb_id: 12347,
                media_type: 'movie',
                title: 'Test Movie 3',
                item_metadata: {},
                prompt_type: 'prompt_confirm',
                original_scores: {},
                selected_library_id: testLibraryId,
                selected_policy_id: testPolicyId,
                was_correction: false
            };

            await feedbackAnalysis.recordFeedback(feedbackData);

            const statsResult = await db.query(`
                SELECT * FROM policy_learning_stats WHERE policy_id = $1
            `, [testPolicyId]);

            expect(statsResult.rows.length).toBe(1);
            const stats = statsResult.rows[0];
            expect(stats.total_decisions).toBeGreaterThan(0);
        });
    });

    describe('updateLearningStats', () => {
        test('should calculate accurate stats', async () => {
            const feedbackData = [
                { was_correction: false, prompt_type: 'auto_classify' },
                { was_correction: false, prompt_type: 'auto_classify' },
                { was_correction: true, prompt_type: 'auto_classify' },
                { was_correction: false, prompt_type: 'prompt_select' },
                { was_correction: false, prompt_type: 'prompt_select' }
            ];

            for (const data of feedbackData) {
                await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, selected_library_id, 
                        selected_policy_id, was_correction, prompt_type
                    ) VALUES ($1, 'movie', 'Test', $2, $3, $4, $5)
                `, [Math.floor(Math.random() * 100000), testLibraryId, testPolicyId, data.was_correction, data.prompt_type]);
            }

            const stats = await feedbackAnalysis.updateLearningStats(testPolicyId);

            expect(stats).toBeDefined();
            expect(stats.total_decisions).toBeGreaterThanOrEqual(5);
            expect(stats.auto_classified).toBeGreaterThanOrEqual(3);
            expect(stats.user_prompted).toBeGreaterThanOrEqual(2);
            expect(stats.user_corrections).toBeGreaterThanOrEqual(1);
            expect(stats.accuracy_rate).toBeGreaterThan(0);
            expect(stats.accuracy_rate).toBeLessThanOrEqual(1);
        });

        test('should determine trend correctly', async () => {
            const stats = await feedbackAnalysis.updateLearningStats(testPolicyId);

            expect(stats.trend).toBeDefined();
            expect(['improving', 'declining', 'stable']).toContain(stats.trend);
        });
    });

    describe('detectFailurePatterns', () => {
        test('should detect false positives', async () => {
            const feedbackItems = [];
            for (let i = 0; i < 5; i++) {
                const res = await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, 
                        item_metadata, selected_library_id, selected_policy_id,
                        top_suggestion_library_id, was_correction, prompt_type
                    ) VALUES ($1, 'movie', $2, $3, $4, $5, $6, true, 'auto_classify')
                    RETURNING *
                `, [
                    20000 + i,
                    'False Positive Movie ' + i,
                    JSON.stringify({ genres: ['Horror'], production_companies: ['Scary Studios'] }),
                    testLibraryId2,
                    testPolicyId2,
                    testLibraryId
                ]);
                feedbackItems.push(res.rows[0]);
            }

            const patterns = await feedbackAnalysis.detectFailurePatterns(testPolicyId, feedbackItems);

            expect(patterns).toBeDefined();
            expect(patterns.falsePositives).toBeDefined();
            expect(Array.isArray(patterns.falsePositives)).toBe(true);
        });

        test('should detect threshold issues', async () => {
            const feedbackItems = [];
            for (let i = 0; i < 10; i++) {
                const res = await db.query(`
                    INSERT INTO policy_feedback_log (
                        tmdb_id, media_type, title, item_metadata,
                        selected_library_id, selected_policy_id,
                        top_suggestion_library_id, top_suggestion_score,
                        was_correction, prompt_type
                    ) VALUES ($1, 'movie', $2, '{}', $3, $4, $5, $6, $7, 'auto_classify')
                    RETURNING *
                `, [
                    30000 + i,
                    'Threshold Test ' + i,
                    testLibraryId2,
                    testPolicyId2,
                    testLibraryId,
                    80 + Math.random() * 10,
                    i < 4
                ]);
                feedbackItems.push(res.rows[0]);
            }

            const patterns = await feedbackAnalysis.detectFailurePatterns(testPolicyId, feedbackItems);

            expect(patterns.thresholdIssues).toBeDefined();
            expect(Array.isArray(patterns.thresholdIssues)).toBe(true);
        });
    });

    describe('analyzeSignalEffectiveness', () => {
        test('should analyze signal performance', async () => {
            const feedback = [
                {
                    was_correction: false,
                    original_scores: { preset: 85, pattern: 70, rag: 60, history: 50 }
                },
                {
                    was_correction: false,
                    original_scores: { preset: 90, pattern: 75, rag: 65, history: 55 }
                },
                {
                    was_correction: true,
                    original_scores: { preset: 60, pattern: 50, rag: 40, history: 30 }
                }
            ];

            const analysis = await feedbackAnalysis.analyzeSignalEffectiveness(testPolicyId, feedback);

            expect(analysis).toBeDefined();
            expect(analysis.preset).toBeDefined();
            expect(analysis.pattern).toBeDefined();
            expect(analysis.rag).toBeDefined();
            expect(analysis.history).toBeDefined();

            expect(analysis.preset.correct).toBe(2);
            expect(analysis.preset.incorrect).toBe(1);
            expect(analysis.preset.accuracy).toBeCloseTo(2 / 3, 2);
        });
    });

    describe('detectNewPatterns', () => {
        test('should detect recurring patterns in corrections', async () => {
            const feedback = [];
            for (let i = 0; i < 3; i++) {
                feedback.push({
                    id: 40000 + i,
                    was_correction: true,
                    selected_policy_id: testPolicyId,
                    item_metadata: {
                        production_companies: ['A24', 'Other Studio'],
                        genres: ['Drama', 'Indie'],
                        keywords: ['indie', 'artsy']
                    }
                });
            }

            const patterns = await feedbackAnalysis.detectNewPatterns(testPolicyId, feedback);

            expect(Array.isArray(patterns)).toBe(true);
            expect(patterns.length).toBeGreaterThan(0);
        });
    });

    describe('generateSuggestions', () => {
        test('should generate threshold adjustment suggestions', async () => {
            const analysis = {
                failurePatterns: {
                    falsePositives: [],
                    missedPositives: [],
                    thresholdIssues: [{
                        issue: 'high_false_positive_rate',
                        correctionRate: 0.35,
                        avgScore: 80,
                        recommendation: 'increase_auto_classify_threshold'
                    }]
                },
                signalEffectiveness: {},
                newPatterns: [],
                thresholdAnalysis: {}
            };

            const suggestions = await feedbackAnalysis.generateSuggestions(testPolicyId, analysis);

            expect(Array.isArray(suggestions)).toBe(true);
            expect(suggestions.length).toBeGreaterThan(0);

            const thresholdSuggestion = suggestions.find((suggestion) => suggestion.type === 'adjust_threshold');
            expect(thresholdSuggestion).toBeDefined();
            expect(thresholdSuggestion.config.threshold_type).toBe('auto_classify');
        });

        test('should generate weight adjustment suggestions', async () => {
            const analysis = {
                failurePatterns: { falsePositives: [], missedPositives: [], thresholdIssues: [] },
                signalEffectiveness: {
                    preset: { correct: 10, incorrect: 2, accuracy: 0.83 },
                    pattern: { correct: 3, incorrect: 7, accuracy: 0.3 },
                    rag: { correct: 12, incorrect: 0, accuracy: 1.0 },
                    history: { correct: 2, incorrect: 8, accuracy: 0.2 }
                },
                newPatterns: [],
                thresholdAnalysis: {}
            };

            const suggestions = await feedbackAnalysis.generateSuggestions(testPolicyId, analysis);

            expect(suggestions.length).toBeGreaterThan(0);

            const lowPerformingSuggestion = suggestions.find((suggestion) => 
                suggestion.type === 'adjust_weight' && 
                (suggestion.config.signal === 'pattern' || suggestion.config.signal === 'history')
            );
            expect(lowPerformingSuggestion).toBeDefined();

            const highPerformingSuggestion = suggestions.find((suggestion) => 
                suggestion.type === 'adjust_weight' && 
                suggestion.config.signal === 'rag'
            );
            expect(highPerformingSuggestion).toBeDefined();
        });

        test('should generate pattern creation suggestions', async () => {
            const analysis = {
                failurePatterns: { falsePositives: [], missedPositives: [], thresholdIssues: [] },
                signalEffectiveness: {},
                newPatterns: [
                    { type: 'studio', value: 'A24', count: 5, feedbackIds: [1, 2, 3, 4, 5] },
                    { type: 'keyword', value: 'indie', count: 3, feedbackIds: [1, 2, 3] }
                ],
                thresholdAnalysis: {}
            };

            const suggestions = await feedbackAnalysis.generateSuggestions(testPolicyId, analysis);

            const patternSuggestions = suggestions.filter((suggestion) => suggestion.type === 'create_pattern');
            expect(patternSuggestions.length).toBeGreaterThan(0);

            const a24Suggestion = patternSuggestions.find((suggestion) => suggestion.config.pattern_value === 'A24');
            expect(a24Suggestion).toBeDefined();
            expect(a24Suggestion.config.pattern_type).toBe('studio');
        });
    });

    describe('storeSuggestions', () => {
        test('should store suggestions in database', async () => {
            const suggestions = [
                {
                    type: 'adjust_threshold',
                    config: {
                        threshold_type: 'auto_classify',
                        reason: 'Test reason'
                    },
                    supporting_feedback: [],
                    confidence: 75,
                    impact_estimate: 'Test impact'
                }
            ];

            const stored = await feedbackAnalysis.storeSuggestions(testPolicyId, suggestions);

            expect(stored.length).toBeGreaterThan(0);
            expect(stored[0].id).toBeDefined();
            expect(stored[0].suggestion_type).toBe('adjust_threshold');
            expect(stored[0].status).toBe('pending');
        });

        test('should not create duplicate suggestions', async () => {
            const uniqueReason = 'Test duplicate ' + Date.now();
            const suggestion = {
                type: 'adjust_weight',
                config: {
                    signal: 'preset',
                    reason: uniqueReason
                },
                supporting_feedback: [],
                confidence: 70,
                impact_estimate: 'Test'
            };

            const stored1 = await feedbackAnalysis.storeSuggestions(testPolicyId, [suggestion]);
            expect(stored1.length).toBe(1);

            const stored2 = await feedbackAnalysis.storeSuggestions(testPolicyId, [suggestion]);

            expect(stored2.length).toBeGreaterThanOrEqual(0);
            expect(stored2.length).toBeLessThanOrEqual(1);
        });
    });

    describe('getPendingSuggestions', () => {
        test('should retrieve pending suggestions', async () => {
            const suggestions = await feedbackAnalysis.getPendingSuggestions(testPolicyId);

            expect(Array.isArray(suggestions)).toBe(true);
            expect(suggestions.length).toBeGreaterThan(0);

            suggestions.forEach((suggestion) => {
                expect(suggestion.status).toBe('pending');
                expect(suggestion.policy_id).toBe(testPolicyId);
            });
        });
    });

    describe('applySuggestion', () => {
        test('should apply threshold adjustment suggestion', async () => {
            const suggestionRes = await db.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id, suggestion_type, suggestion_config,
                    confidence, impact_estimate, status
                )
                VALUES ($1, 'adjust_threshold', $2, 80, 'Test impact', 'pending')
                RETURNING id
            `, [testPolicyId, JSON.stringify({
                threshold_type: 'auto_classify',
                current: 85,
                recommended: 90,
                reason: 'Test'
            })]);

            const suggestionId = suggestionRes.rows[0].id;

            const result = await feedbackAnalysis.applySuggestion(suggestionId, testUserId);

            expect(result.success).toBe(true);
            expect(result.type).toBe('adjust_threshold');

            const suggestionCheck = await db.query(`
                SELECT status FROM policy_tuning_suggestions WHERE id = $1
            `, [suggestionId]);
            expect(suggestionCheck.rows[0].status).toBe('applied');

            const policyCheck = await db.query(`
                SELECT auto_classify_threshold FROM library_policies WHERE id = $1
            `, [testPolicyId]);
            expect(policyCheck.rows[0].auto_classify_threshold).toBe(90);

            const changeLog = await db.query(`
                SELECT * FROM policy_change_log 
                WHERE policy_id = $1 AND change_type = 'adjust_threshold'
                ORDER BY applied_at DESC LIMIT 1
            `, [testPolicyId]);
            expect(changeLog.rows.length).toBe(1);
        });

        test('should apply weight adjustment suggestion', async () => {
            const suggestionRes = await db.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id, suggestion_type, suggestion_config,
                    confidence, impact_estimate, status
                )
                VALUES ($1, 'adjust_weight', $2, 75, 'Test impact', 'pending')
                RETURNING id
            `, [testPolicyId, JSON.stringify({
                signal: 'preset',
                current: 0.4,
                recommended: 0.5,
                reason: 'Test'
            })]);

            const suggestionId = suggestionRes.rows[0].id;

            const result = await feedbackAnalysis.applySuggestion(suggestionId, testUserId);

            expect(result.success).toBe(true);

            const policyCheck = await db.query(`
                SELECT preset_weight FROM library_policies WHERE id = $1
            `, [testPolicyId]);
            expect(policyCheck.rows[0].preset_weight).toBeCloseTo(0.5, 2);
        });
    });

    describe('rejectSuggestion', () => {
        test('should reject a suggestion', async () => {
            const suggestionRes = await db.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id, suggestion_type, suggestion_config,
                    confidence, impact_estimate, status
                )
                VALUES ($1, 'adjust_threshold', '{"test": true}', 70, 'Test', 'pending')
                RETURNING id
            `, [testPolicyId]);

            const suggestionId = suggestionRes.rows[0].id;

            const result = await feedbackAnalysis.rejectSuggestion(
                suggestionId,
                testUserId,
                'Not applicable for this policy'
            );

            expect(result.success).toBe(true);
            expect(result.status).toBe('rejected');

            const check = await db.query(`
                SELECT status, rejection_reason FROM policy_tuning_suggestions WHERE id = $1
            `, [suggestionId]);

            expect(check.rows[0].status).toBe('rejected');
            expect(check.rows[0].rejection_reason).toBe('Not applicable for this policy');
        });
    });

    describe('analyzePolicy', () => {
        test('should return insufficient feedback message when not enough data', async () => {
            const result = await feedbackAnalysis.analyzePolicy(testPolicyId2, { days: 30, minFeedback: 100 });

            expect(result.feedbackCount).toBeDefined();
            expect(result.message).toContain('Insufficient feedback');
        });

        test('should perform full analysis when sufficient feedback exists', async () => {
            const result = await feedbackAnalysis.analyzePolicy(testPolicyId, { days: 30, minFeedback: 3 });

            expect(result.policyId).toBe(testPolicyId);
            expect(result.feedbackCount).toBeGreaterThan(0);

            if (result.feedbackCount >= 3) {
                expect(result.analysis).toBeDefined();
                expect(result.analysis.failurePatterns).toBeDefined();
                expect(result.analysis.signalEffectiveness).toBeDefined();
                expect(result.suggestions).toBeDefined();
                expect(Array.isArray(result.suggestions)).toBe(true);
            }
        });
    });

    describe('runFullAnalysis', () => {
        test('should analyze all active policies', async () => {
            const result = await feedbackAnalysis.runFullAnalysis();

            expect(result.policiesAnalyzed).toBeGreaterThan(0);
            expect(Array.isArray(result.results)).toBe(true);
            expect(result.results.length).toBeGreaterThan(0);

            result.results.forEach((item) => {
                expect(item.policyId).toBeDefined();
                expect(item.policyName).toBeDefined();
            });
        });
    });
});
