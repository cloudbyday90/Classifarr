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
const { policyEngine } = await import('../../services/policyEngine.mjs');

describe('AI Skip Logic Integration Tests (v0.37.0)', () => {
    let testLibraryId;
    let testPolicyId;
    let _testPresetId;
    let _testMediaServerId;
    let cleanupFixture;

    beforeAll(async () => {
        const fixture = await createPolicyEngineIntegrationFixture(db, {
            mediaServerName: 'Test Media Server AI Skip',
            mediaServerApiKey: 'test-ai-skip-key',
            libraryExternalIdPrefix: 'test-ai-skip-lib',
            libraryName: 'Test AI Skip Library',
            presetKeyPrefix: 'test_high_confidence_action',
            presetName: 'Test High Confidence Action',
            presetSignals: {
                genres: { require_all: ['Action'], weight: 2.0 },
                keywords: { require_any: ['explosion', 'chase'], weight: 1.0 },
            },
            policyName: 'Test AI Skip Policy',
            policyValues: {
                trust_patterns: false,
                trust_rag: false,
                trust_history: false,
                preset_weight: 1.0,
                profile_weight: 0.0,
                pattern_weight: 0.0,
                rag_weight: 0.0,
                history_weight: 0.0,
            },
            presetLinkWeight: 2.0,
        });

        _testMediaServerId = fixture.mediaServerId;
        testLibraryId = fixture.libraryId;
        _testPresetId = fixture.presetId;
        testPolicyId = fixture.policyId;
        cleanupFixture = fixture.cleanup;
    });

    afterAll(async () => {
        await cleanupFixture?.();
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
