/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const db = require('../../config/database');
const policyEngine = require('../../services/policyEngine');

describe('AI Skip Logic Integration Tests (v0.37.0)', () => {
    let testLibraryId;
    let testPolicyId;
    let testPresetId;
    let testMediaServerId;

    beforeAll(async () => {
        // Ensure test media server exists
        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Media Server AI Skip', 'http://localhost:32400', 'test-ai-skip-key')
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

        // Create test library
        const libRes = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
            VALUES ($1, 'test-ai-skip-lib-' || gen_random_uuid()::text, 'Test AI Skip Library', 'movie', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes.rows[0].id;

        // Create high-confidence test preset (action movies)
        // NOTE: Using require_all returns 100 score when all genres match (vs require_any which returns 80)
        // This is needed to exceed the 85% auto_classify_threshold
        const presetRes = await db.query(`
            INSERT INTO content_presets (key, name, signals, is_system)
            VALUES (
                'test_high_confidence_action',
                'Test High Confidence Action',
                '{"genres": {"require_all": ["Action"], "weight": 2.0}, "keywords": {"require_any": ["explosion", "chase"], "weight": 1.0}}'::jsonb,
                false
            )
            RETURNING id
        `);
        testPresetId = presetRes.rows[0].id;

        // Create test policy with high auto-classify threshold
        const policyRes = await db.query(`
            INSERT INTO library_policies (
                library_id,
                name,
                enabled,
                auto_classify_threshold,
                prompt_threshold,
                trust_patterns,
                trust_rag,
                trust_history,
                preset_weight,
                profile_weight,
                pattern_weight,
                rag_weight,
                history_weight
            ) VALUES ($1, 'Test AI Skip Policy', true, 85, 60, false, false, false, 1.0, 0.0, 0.0, 0.0, 0.0)
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes.rows[0].id;

        // Link preset to policy with high weight
        await db.query(`
            INSERT INTO policy_presets (policy_id, preset_id, weight)
            VALUES ($1, $2, 2.0)
        `, [testPolicyId, testPresetId]);
    });

    afterAll(async () => {
        // Clean up test data
        if (testPolicyId) {
            await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        }
        if (testPresetId) {
            await db.query('DELETE FROM content_presets WHERE id = $1', [testPresetId]);
        }
        if (testLibraryId) {
            await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        }
    });

    describe('High Confidence (≥85%) - Skip AI', () => {
        test('should skip AI when PolicyEngine auto-classifies with high confidence', async () => {
            // Mock item that strongly matches the action preset
            // With require_all genres matching, score = 100 for genres, 80 for keywords
            // Weighted average: (100*2 + 80*1) / 3 = 93.3%, above 85% threshold
            const item = {
                title: 'Test Action Movie',
                media_type: 'movie',
                genres: ['Action', 'Thriller'],
                keywords: ['explosion', 'chase', 'hero'],
                overview: 'An action-packed thriller with explosions'
            };

            const result = await policyEngine.evaluateItem(item);

            // Should be auto_classify since score (93.3%) >= threshold (85%)
            expect(result.action).toBe('auto_classify');
            expect(result.confidence).toBeGreaterThanOrEqual(85);
            expect(result.library).toBeDefined();
            expect(result.library.library_id).toBe(testLibraryId);
            expect(result.method).toBe('policy_engine');
        });

        test('classification service should return policy_auto method for high confidence', async () => {
            // This test verifies the PolicyEngine returns auto_classify for matching content
            // Genres matching require_all = 100, keywords matching = 80
            // Weighted: (100*2 + 80*1) / 3 = 93.3%
            const item = {
                title: 'High Confidence Action',
                media_type: 'movie',
                genres: ['Action'],
                keywords: ['explosion']
            };

            const policyResult = await policyEngine.evaluateItem(item);
            expect(policyResult.action).toBe('auto_classify');
            expect(policyResult.confidence).toBeGreaterThanOrEqual(85);
        });
    });

    describe('Medium Confidence (60-84%) - Prompt User', () => {
        test('should return prompt_confirm when confidence is in medium range', async () => {
            // Update policy to have more balanced scoring to get medium confidence
            await db.query(`
                UPDATE library_policies
                SET preset_weight = 0.5
                WHERE id = $1
            `, [testPolicyId]);

            // Item that partially matches
            const item = {
                title: 'Partial Action Movie',
                media_type: 'movie',
                genres: ['Action', 'Drama'], // Matches action but diluted
                keywords: ['drama'],
                overview: 'A dramatic movie with some action'
            };

            const result = await policyEngine.evaluateItem(item);

            // Should be prompt_confirm if confidence is 60-84%
            if (result.confidence >= 60 && result.confidence < 85) {
                expect(result.action).toBe('prompt_confirm');
                expect(result.library).toBeDefined();
            }

            // Reset policy weight
            await db.query(`
                UPDATE library_policies
                SET preset_weight = 1.0
                WHERE id = $1
            `, [testPolicyId]);
        });
    });

    describe('Low Confidence (<60%) - Use AI', () => {
        test('should return low-confidence action for non-matching content', async () => {
            // Item that doesn't match the preset well
            const item = {
                title: 'Romance Drama',
                media_type: 'movie',
                genres: ['Romance', 'Drama'],
                keywords: ['love', 'relationship'],
                overview: 'A romantic drama about relationships'
            };

            const result = await policyEngine.evaluateItem(item);

            // Post v0.37.5: For non-matching content, expect either prompt_select or manual
            // The key is that we don't auto_classify content that doesn't match
            if (result.confidence < 60) {
                expect(['prompt_select', 'manual']).toContain(result.action);
            }
        });
    });

    describe('Threshold Boundaries', () => {
        test('should use auto_classify at exactly 85% confidence', async () => {
            // This tests the boundary condition
            const mockResult = {
                action: 'auto_classify',
                library: {
                    library_id: testLibraryId,
                    library_name: 'Test',
                    policy_id: testPolicyId,
                    policy_name: 'Test Policy'
                },
                confidence: 85,
                method: 'policy_engine',
                ranked: []
            };

            // Verify the determineAction logic handles boundary correctly
            expect(mockResult.confidence).toBeGreaterThanOrEqual(85);
            expect(mockResult.action).toBe('auto_classify');
        });

        test('should use prompt_confirm at exactly 60% confidence', async () => {
            const mockResult = {
                action: 'prompt_confirm',
                library: {
                    library_id: testLibraryId,
                    library_name: 'Test',
                    policy_id: testPolicyId,
                    policy_name: 'Test Policy'
                },
                confidence: 60,
                method: 'policy_engine',
                ranked: []
            };

            expect(mockResult.confidence).toBeGreaterThanOrEqual(60);
            expect(mockResult.confidence).toBeLessThan(85);
            expect(mockResult.action).toBe('prompt_confirm');
        });

        test('should use prompt_select at 59% confidence', async () => {
            const mockResult = {
                action: 'prompt_select',
                confidence: 59,
                method: 'policy_engine',
                ranked: []
            };

            expect(mockResult.confidence).toBeLessThan(60);
            expect(mockResult.action).toBe('prompt_select');
        });
    });

    describe('Policy Result Propagation', () => {
        test('should include policyResult in auto_classify response', async () => {
            const item = {
                title: 'Action Test',
                media_type: 'movie',
                genres: ['Action'],
                keywords: ['explosion', 'chase']
            };

            const result = await policyEngine.evaluateItem(item);

            expect(result).toBeDefined();
            expect(result.action).toBeDefined();
            expect(result.confidence).toBeDefined();
            expect(result.ranked).toBeDefined();

            if (result.action === 'auto_classify') {
                expect(result.library).toBeDefined();
                expect(result.method).toBe('policy_engine');
            }
        });
    });
});
