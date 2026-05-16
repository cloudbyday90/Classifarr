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
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { router: policiesRouter } = await import('../../routes/policies.mjs');
const app = createIntegrationTestApp({
    basePath: '/api/policies',
    router: policiesRouter,
});

describe('Policies API Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testPresetIds = [];
    let customPresetId;

    // Setup test data before all tests
    beforeAll(async () => {
        // Create a test media server first
        const mediaServerResult = await db.query(`
            INSERT INTO media_server (name, type, url, api_key, is_active)
            VALUES ('Test Server', 'plex', 'http://localhost:32400', 'test-key', true)
            RETURNING id
        `);
        const mediaServerId = mediaServerResult.rows[0].id;

        // Create a test library
        const libraryResult = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
            VALUES ($1, 'test-lib-1', 'Test Library', 'movie', true, 5)
            RETURNING id
        `, [mediaServerId]);
        testLibraryId = libraryResult.rows[0].id;

        // Get some test presets
        const presetsResult = await db.query(`
            SELECT id FROM content_presets WHERE is_system = true LIMIT 5
        `);
        testPresetIds = presetsResult.rows.map(r => r.id);

        await db.query(`
            DELETE FROM content_presets
            WHERE key = 'test_custom_policy_preset'
        `);

        const customPresetResult = await db.query(`
            INSERT INTO content_presets (
                key, name, description, icon, category, signals, is_system, display_order
            )
            VALUES (
                'test_custom_policy_preset',
                'Anime Family Remix',
                'Custom preset attachable to policies and matching anime libraries',
                '⚙️',
                'custom',
                '{"genres":{"prefer":["Family"]}}'::jsonb,
                false,
                0
            )
            RETURNING id
        `);
        customPresetId = customPresetResult.rows[0].id;
    });

    // Clean up after all tests
    afterAll(async () => {
        // Delete test policy (cascade will handle policy_presets)
        if (testPolicyId) {
            await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        }
        await db.query("DELETE FROM content_presets WHERE key = 'test_custom_policy_preset'");
        // Delete test library and media server (cascade will handle libraries)
        await db.query('DELETE FROM media_server WHERE name = $1', ['Test Server']);
    });

    describe('GET /api/policies', () => {
        test('should return list of policies', async () => {
            const response = await request(app)
                .get('/api/policies')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('POST /api/policies', () => {
        test('should create a new policy', async () => {
            const newPolicy = {
                library_id: testLibraryId,
                name: 'Test Policy',
                description: 'Test policy description',
                enabled: true,
                priority: 5,
                auto_classify_threshold: 85,
                prompt_threshold: 60,
                preset_weight: 0.35,
                profile_weight: 0.25,
                pattern_weight: 0.15,
                rag_weight: 0.15,
                history_weight: 0.10,
                combination_mode: 'best_match',
                presets: [
                    { preset_id: testPresetIds[0], weight: 1.0 },
                    { preset_id: testPresetIds[1], weight: 1.5 }
                ]
            };

            const response = await request(app)
                .post('/api/policies')
                .send(newPolicy)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.name).toBe('Test Policy');
            expect(response.body.library_id).toBe(testLibraryId);
            expect(response.body.presets).toHaveLength(2);

            testPolicyId = response.body.id;
        });

        test('should fail without required fields', async () => {
            const invalidPolicy = {
                description: 'Missing name and library_id'
            };

            await request(app)
                .post('/api/policies')
                .send(invalidPolicy)
                .expect(400);
        });
    });

    describe('GET /api/policies/:id', () => {
        test('should return policy with presets', async () => {
            const response = await request(app)
                .get(`/api/policies/${testPolicyId}`)
                .expect(200);

            expect(response.body.id).toBe(testPolicyId);
            expect(response.body.name).toBe('Test Policy');
            expect(Array.isArray(response.body.presets)).toBe(true);
            expect(response.body.presets.length).toBeGreaterThan(0);
        });

        test('should return 404 for non-existent policy', async () => {
            await request(app)
                .get('/api/policies/999999')
                .expect(404);
        });
    });

    describe('PUT /api/policies/:id', () => {
        test('should update policy', async () => {
            const updates = {
                name: 'Updated Test Policy',
                description: 'Updated description',
                auto_classify_threshold: 90,
                presets: [
                    { preset_id: testPresetIds[0], weight: 2.0 },
                    { preset_id: testPresetIds[2], weight: 1.0 }
                ]
            };

            const response = await request(app)
                .put(`/api/policies/${testPolicyId}`)
                .send(updates)
                .expect(200);

            expect(response.body.name).toBe('Updated Test Policy');
            expect(response.body.auto_classify_threshold).toBe(90);
            expect(response.body.presets).toHaveLength(2);
        });

        test('should reject partial updates that break merged weight totals', async () => {
            const response = await request(app)
                .put(`/api/policies/${testPolicyId}`)
                .send({ preset_weight: 0.9 })
                .expect(400);

            expect(response.body.error).toContain('Weights must sum to 1.0');
        });
    });

    describe('GET /api/policies/:id/presets', () => {
        test('should return policy presets', async () => {
            const response = await request(app)
                .get(`/api/policies/${testPolicyId}/presets`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('weight');
        });
    });

    describe('POST /api/policies/:id/presets', () => {
        test('should attach preset to policy', async () => {
            const response = await request(app)
                .post(`/api/policies/${testPolicyId}/presets`)
                .send({ preset_id: testPresetIds[3], weight: 1.2 })
                .expect(201);

            expect(response.body).toHaveProperty('policy_id', testPolicyId);
            expect(response.body).toHaveProperty('preset_id', testPresetIds[3]);
        });

        test('should fail to attach duplicate preset', async () => {
            await request(app)
                .post(`/api/policies/${testPolicyId}/presets`)
                .send({ preset_id: testPresetIds[3], weight: 1.0 })
                .expect(400);
        });

        test('should accept custom_signals alias when attaching preset', async () => {
            const response = await request(app)
                .post(`/api/policies/${testPolicyId}/presets`)
                .send({
                    preset_id: testPresetIds[4],
                    custom_signals: {
                        language: {
                            require_any: ['sv'],
                            strict: true
                        }
                    }
                })
                .expect(201);

            expect(response.body.customSignals).toEqual({
                language: {
                    require_any: ['sv'],
                    strict: true
                }
            });

            await request(app)
                .delete(`/api/policies/${testPolicyId}/presets/${testPresetIds[4]}`)
                .expect(200);
        });

        test('should attach a custom preset to policy', async () => {
            const response = await request(app)
                .post(`/api/policies/${testPolicyId}/presets`)
                .send({ preset_id: customPresetId, weight: 1.1 })
                .expect(201);

            expect(response.body).toHaveProperty('policy_id', testPolicyId);
            expect(response.body).toHaveProperty('preset_id', customPresetId);

            const policyResponse = await request(app)
                .get(`/api/policies/${testPolicyId}`)
                .expect(200);

            expect(policyResponse.body.presets.some(preset => preset.id === customPresetId && preset.source === 'custom')).toBe(true);

            await request(app)
                .delete(`/api/policies/${testPolicyId}/presets/${customPresetId}`)
                .expect(200);
        });
    });

    describe('DELETE /api/policies/:id/presets/:presetId', () => {
        test('should remove preset from policy', async () => {
            await request(app)
                .delete(`/api/policies/${testPolicyId}/presets/${testPresetIds[3]}`)
                .expect(200);
        });

        test('should return 404 for non-attached preset', async () => {
            await request(app)
                .delete(`/api/policies/${testPolicyId}/presets/${testPresetIds[4]}`)
                .expect(404);
        });
    });

    describe('GET /api/policies/presets/all', () => {
        test('should return all attachable presets including custom presets', async () => {
            const response = await request(app)
                .get('/api/policies/presets/all')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body.some(preset => preset.id === customPresetId && preset.source === 'custom')).toBe(true);
            response.body.forEach(preset => {
                expect(preset).toHaveProperty('usage_count');
                expect(Number.isInteger(preset.usage_count)).toBe(true);
                expect(preset.usage_count).toBeGreaterThanOrEqual(0);
            });
        });

        test('should support builtin-only attachable preset mode', async () => {
            const response = await request(app)
                .get('/api/policies/presets/all?include_custom=false')
                .expect(200);

            expect(response.body.every(preset => preset.source === 'builtin')).toBe(true);
        });

        test('should filter by category', async () => {
            const response = await request(app)
                .get('/api/policies/presets/all?category=audience')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(preset => {
                expect(preset.category).toBe('audience');
            });
        });

        test('should search presets', async () => {
            const response = await request(app)
                .get('/api/policies/presets/all?search=family')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(preset => {
                const searchTerm = preset.name.toLowerCase() + ' ' + (preset.description || '').toLowerCase();
                expect(searchTerm).toContain('family');
            });
        });
    });

    describe('GET /api/policies/presets/categories', () => {
        test('should return preset categories with counts', async () => {
            const response = await request(app)
                .get('/api/policies/presets/categories')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            response.body.forEach(cat => {
                expect(cat).toHaveProperty('category');
                expect(cat).toHaveProperty('count');
                expect(parseInt(cat.count)).toBeGreaterThan(0);
            });
        });
    });

    describe('GET /api/policies/presets/:presetId/usage', () => {
        test('should return usage count for preset', async () => {
            // Use a preset that was attached to testPolicy
            const response = await request(app)
                .get(`/api/policies/presets/${testPresetIds[0]}/usage`)
                .expect(200);

            expect(response.body).toHaveProperty('count');
            expect(typeof response.body.count).toBe('number');
            expect(response.body.count).toBeGreaterThanOrEqual(1); // At least used in testPolicy
        });

        test('should return 0 for unused preset', async () => {
            // Find a preset that's not being used
            const unusedPresetResult = await db.query(`
                SELECT id FROM content_presets
                WHERE is_system = true 
                AND id NOT IN (SELECT preset_id FROM policy_presets)
                LIMIT 1
            `);

            if (unusedPresetResult.rows.length > 0) {
                const unusedPresetId = unusedPresetResult.rows[0].id;
                const response = await request(app)
                    .get(`/api/policies/presets/${unusedPresetId}/usage`)
                    .expect(200);

                expect(response.body.count).toBe(0);
            }
        });

        test('should return 400 for invalid presetId (non-numeric)', async () => {
            const response = await request(app)
                .get('/api/policies/presets/invalid/usage')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid presetId');
        });

        test('should return 400 for invalid presetId (negative number)', async () => {
            const response = await request(app)
                .get('/api/policies/presets/-1/usage')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid presetId');
        });

        test('should return 400 for invalid presetId (zero)', async () => {
            const response = await request(app)
                .get('/api/policies/presets/0/usage')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Invalid presetId');
        });
    });

    describe('GET /api/policies/presets/suggest/:libraryId', () => {
        let animeLibraryId;
        let comedyLibraryId;

        beforeAll(async () => {
            // Create libraries with names that should match presets
            const animeResult = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                SELECT id, 'test-anime-lib', 'Anime Movies', 'movie', true
                FROM media_server WHERE name = 'Test Server'
                RETURNING id
            `);
            animeLibraryId = animeResult.rows[0].id;

            const comedyResult = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
                SELECT id, 'test-comedy-lib', 'Comedy and Standup', 'movie', true
                FROM media_server WHERE name = 'Test Server'
                RETURNING id
            `);
            comedyLibraryId = comedyResult.rows[0].id;
        });

        afterAll(async () => {
            // Clean up test libraries
            await db.query("DELETE FROM libraries WHERE external_id IN ('test-anime-lib', 'test-comedy-lib')");
        });

        test('should return suggestions for anime library', async () => {
            const response = await request(app)
                .get(`/api/policies/presets/suggest/${animeLibraryId}`)
                .expect(200);

            expect(response.body).toHaveProperty('library_id', animeLibraryId);
            expect(response.body).toHaveProperty('library_name', 'Anime Movies');
            expect(response.body).toHaveProperty('suggestions');
            expect(Array.isArray(response.body.suggestions)).toBe(true);

            // Should suggest anime preset with high score
            const animeSuggestion = response.body.suggestions.find(s => s.key === 'anime');
            expect(animeSuggestion).toBeDefined();
            expect(animeSuggestion.suggestion_score).toBeGreaterThan(0);
            expect(animeSuggestion.match_score).toBe(animeSuggestion.suggestion_score);
        });

        test('should return suggestions for comedy library', async () => {
            const response = await request(app)
                .get(`/api/policies/presets/suggest/${comedyLibraryId}`)
                .expect(200);

            expect(response.body.suggestions.length).toBeGreaterThan(0);

            // Should suggest comedy preset
            const comedySuggestion = response.body.suggestions.find(s => s.key === 'comedy');
            expect(comedySuggestion).toBeDefined();
        });

        test('should return 404 for non-existent library', async () => {
            await request(app)
                .get('/api/policies/presets/suggest/999999')
                .expect(404);
        });

        test('suggestions should expose suggestion fields and compatibility aliases', async () => {
            const response = await request(app)
                .get(`/api/policies/presets/suggest/${animeLibraryId}`)
                .expect(200);

            response.body.suggestions.forEach(suggestion => {
                expect(suggestion).toHaveProperty('suggestion_score');
                expect(suggestion).toHaveProperty('suggestion_reasons');
                expect(suggestion.suggestion_score).toBeGreaterThan(0);
                expect(Array.isArray(suggestion.suggestion_reasons)).toBe(true);
                expect(suggestion).toHaveProperty('match_score');
                expect(suggestion).toHaveProperty('match_reasons');
                expect(suggestion.match_score).toBe(suggestion.suggestion_score);
                expect(Array.isArray(suggestion.match_reasons)).toBe(true);
            });
        });

        test('should include matching custom presets in attachable suggestions', async () => {
            const response = await request(app)
                .get(`/api/policies/presets/suggest/${animeLibraryId}`)
                .expect(200);

            const customSuggestion = response.body.suggestions.find(s => s.id === customPresetId);
            expect(customSuggestion).toBeDefined();
            expect(customSuggestion.source).toBe('custom');
            expect(customSuggestion.suggestion_score).toBeGreaterThan(0);
        });

        test('should not falsely suggest scandinavian for comedy and standup from stopword overlap', async () => {
            const response = await request(app)
                .get(`/api/policies/presets/suggest/${comedyLibraryId}`)
                .expect(200);

            const scandinavianSuggestion = response.body.suggestions.find(s => s.key === 'scandinavian');
            expect(scandinavianSuggestion).toBeUndefined();
        });
    });

    describe('DELETE /api/policies/:id (Reset)', () => {
        test('should reset policy (delete and create new blank)', async () => {
            const response = await request(app)
                .delete(`/api/policies/${testPolicyId}`)
                .expect(200);

            expect(response.body.message).toContain('reset');
            expect(response.body).toHaveProperty('oldPolicy');
            expect(response.body).toHaveProperty('newPolicy');

            // Verify new policy was created for the same library
            expect(response.body.newPolicy.library_id).toBe(testLibraryId);
            expect(response.body.newPolicy.id).not.toBe(testPolicyId);

            // Verify old policy ID no longer exists
            await request(app)
                .get(`/api/policies/${testPolicyId}`)
                .expect(404);

            // Update testPolicyId to the new policy for cleanup
            testPolicyId = response.body.newPolicy.id;
        });

        test('reset policy should have default thresholds', async () => {
            // Verify the reset policy has default values
            const response = await request(app)
                .get(`/api/policies/${testPolicyId}`)
                .expect(200);

            expect(response.body.auto_classify_threshold).toBe(85);
            expect(response.body.prompt_threshold).toBe(60);
            expect(response.body.enabled).toBe(true);
        });
    });
});
