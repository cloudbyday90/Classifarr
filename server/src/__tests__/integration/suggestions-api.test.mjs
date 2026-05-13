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
import { createMountedTestApp } from '../helpers/setupRouteTest.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { router: suggestionsRouter } = await import('../../routes/suggestions.mjs');
const app = createMountedTestApp({
    basePath: '/api/suggestions',
    router: suggestionsRouter,
});

describe('Suggestions API Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testSuggestionId;
    let testUserId;
    let testMediaServerId;

    beforeAll(async () => {
        // Create test user
        const userRes = await db.query(`
            INSERT INTO users (username, password_hash, role)
            VALUES ('test-suggestions-user', 'hash', 'admin')
            RETURNING id
        `);
        testUserId = userRes.rows[0].id;

        // Create test media server
        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Suggestions Server', 'http://localhost:32400', 'test-key')
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
            VALUES ($1, 'test-suggestions-lib-' || gen_random_uuid()::text, 'Test Suggestions Library', 'movie', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes.rows[0].id;

        // Create test policy
        const policyRes = await db.query(`
            INSERT INTO library_policies (
                library_id,
                name,
                enabled,
                auto_classify_threshold,
                prompt_threshold
            ) VALUES ($1, 'Test Suggestions Policy', true, 85, 60)
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes.rows[0].id;

        // Create test suggestion
        const suggestionRes = await db.query(`
            INSERT INTO policy_tuning_suggestions (
                policy_id,
                suggestion_type,
                suggestion_config,
                confidence,
                impact_estimate,
                status
            ) VALUES ($1, 'adjust_threshold', $2, 75, 'May improve accuracy by 5%', 'pending')
            RETURNING id
        `, [testPolicyId, JSON.stringify({
            threshold_type: 'auto_classify',
            current: 85,
            recommended: 90,
            reason: 'High false positive rate'
        })]);
        testSuggestionId = suggestionRes.rows[0].id;

        // Initialize policy learning stats
        await db.query(`
            INSERT INTO policy_learning_stats (
                policy_id,
                accuracy_rate,
                auto_accuracy_rate
            ) VALUES ($1, 80.0, 85.0)
            ON CONFLICT (policy_id) DO UPDATE
            SET accuracy_rate = 80.0, auto_accuracy_rate = 85.0
        `, [testPolicyId]);
    });

    afterAll(async () => {
        // Cleanup
        await db.query('DELETE FROM policy_tuning_suggestions WHERE policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM policy_learning_stats WHERE policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    describe('GET /api/suggestions', () => {
        it('should list all pending suggestions', async () => {
            const response = await request(app)
                .get('/api/suggestions')
                .query({ status: 'pending' });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);

            const suggestion = response.body.find(s => s.id === testSuggestionId);
            expect(suggestion).toBeDefined();
            expect(suggestion.status).toBe('pending');
            expect(suggestion.suggestion_type).toBe('adjust_threshold');
        });

        it('should filter suggestions by policy', async () => {
            const response = await request(app)
                .get('/api/suggestions')
                .query({ policyId: testPolicyId });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);

            response.body.forEach(suggestion => {
                expect(suggestion.policy_id).toBe(testPolicyId);
            });
        });

        it('should return all suggestions when no filter specified', async () => {
            const response = await request(app)
                .get('/api/suggestions')
                .query({ status: '' });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/suggestions/:id', () => {
        it('should get suggestion details with supporting evidence', async () => {
            const response = await request(app)
                .get(`/api/suggestions/${testSuggestionId}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(testSuggestionId);
            expect(response.body.suggestion_type).toBe('adjust_threshold');
            expect(response.body.policy_name).toBe('Test Suggestions Policy');
            expect(response.body.library_name).toBe('Test Suggestions Library');
            expect(response.body.supporting_feedback).toBeDefined();
            expect(Array.isArray(response.body.supporting_feedback)).toBe(true);
        });

        it('should return 404 for non-existent suggestion', async () => {
            const response = await request(app)
                .get('/api/suggestions/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Suggestion not found');
        });
    });

    describe('POST /api/suggestions/:id/apply', () => {
        let applySuggestionId;

        beforeEach(async () => {
            // Create a fresh suggestion for each test
            const res = await db.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id,
                    suggestion_type,
                    suggestion_config,
                    confidence,
                    impact_estimate,
                    status
                ) VALUES ($1, 'adjust_threshold', $2, 75, 'Test impact', 'pending')
                RETURNING id
            `, [testPolicyId, JSON.stringify({
                threshold_type: 'auto_classify',
                current: 85,
                recommended: 90,
                reason: 'Test reason'
            })]);
            applySuggestionId = res.rows[0].id;
        });

        afterEach(async () => {
            // Cleanup created suggestion
            await db.query('DELETE FROM policy_tuning_suggestions WHERE id = $1', [applySuggestionId]);
        });

        it('should apply a suggestion and update status', async () => {
            const response = await request(app)
                .post(`/api/suggestions/${applySuggestionId}/apply`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify suggestion was marked as applied
            const suggestionCheck = await db.query(
                'SELECT status, before_accuracy FROM policy_tuning_suggestions WHERE id = $1',
                [applySuggestionId]
            );
            expect(suggestionCheck.rows[0].status).toBe('applied');
            expect(suggestionCheck.rows[0].before_accuracy).toBeDefined();
        });

        it('should store before_accuracy when applying', async () => {
            const response = await request(app)
                .post(`/api/suggestions/${applySuggestionId}/apply`);

            expect(response.status).toBe(200);

            const suggestionCheck = await db.query(
                'SELECT before_accuracy FROM policy_tuning_suggestions WHERE id = $1',
                [applySuggestionId]
            );

            // Should have captured the current accuracy
            expect(suggestionCheck.rows[0].before_accuracy).toBeGreaterThanOrEqual(0);
        });
    });

    describe('POST /api/suggestions/:id/reject', () => {
        let rejectSuggestionId;

        beforeEach(async () => {
            // Create a fresh suggestion for each test
            const res = await db.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id,
                    suggestion_type,
                    suggestion_config,
                    confidence,
                    impact_estimate,
                    status
                ) VALUES ($1, 'create_pattern', $2, 70, 'Test impact', 'pending')
                RETURNING id
            `, [testPolicyId, JSON.stringify({
                pattern_type: 'genre',
                pattern_value: 'Action',
                confidence: 80
            })]);
            rejectSuggestionId = res.rows[0].id;
        });

        afterEach(async () => {
            await db.query('DELETE FROM policy_tuning_suggestions WHERE id = $1', [rejectSuggestionId]);
        });

        it('should reject a suggestion with reason', async () => {
            const reason = 'Not applicable to this policy';
            const response = await request(app)
                .post(`/api/suggestions/${rejectSuggestionId}/reject`)
                .send({ reason });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify suggestion was marked as rejected
            const suggestionCheck = await db.query(
                'SELECT status, rejection_reason FROM policy_tuning_suggestions WHERE id = $1',
                [rejectSuggestionId]
            );
            expect(suggestionCheck.rows[0].status).toBe('rejected');
            expect(suggestionCheck.rows[0].rejection_reason).toBe(reason);
        });

        it('should reject with default reason if none provided', async () => {
            const response = await request(app)
                .post(`/api/suggestions/${rejectSuggestionId}/reject`)
                .send({});

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/suggestions/:id/impact', () => {
        it('should return impact metrics for applied suggestion', async () => {
            // First apply a suggestion
            const appliedRes = await db.query(`
                INSERT INTO policy_tuning_suggestions (
                    policy_id,
                    suggestion_type,
                    suggestion_config,
                    confidence,
                    impact_estimate,
                    status,
                    before_accuracy,
                    applied_at
                ) VALUES ($1, 'adjust_weight', $2, 80, 'Test', 'applied', 75.0, NOW())
                RETURNING id
            `, [testPolicyId, JSON.stringify({ signal: 'preset', current: 0.4, recommended: 0.5 })]);

            const appliedSuggestionId = appliedRes.rows[0].id;

            const response = await request(app)
                .get(`/api/suggestions/${appliedSuggestionId}/impact`);

            expect(response.status).toBe(200);
            expect(response.body.before_accuracy).toBe(75.0);
            expect(response.body.after_accuracy).toBeDefined();
            expect(response.body.improvement).toBeDefined();
            expect(response.body.applied_at).toBeDefined();

            // Cleanup
            await db.query('DELETE FROM policy_tuning_suggestions WHERE id = $1', [appliedSuggestionId]);
        });

        it('should return 404 for non-existent suggestion', async () => {
            const response = await request(app)
                .get('/api/suggestions/999999/impact');

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/suggestions/policy/:policyId/summary', () => {
        it('should return summary statistics for a policy', async () => {
            const response = await request(app)
                .get(`/api/suggestions/policy/${testPolicyId}/summary`);

            expect(response.status).toBe(200);
            expect(response.body.pending_count).toBeDefined();
            expect(response.body.applied_count).toBeDefined();
            expect(response.body.rejected_count).toBeDefined();
            expect(typeof response.body.pending_count).toBe('number');
        });
    });
});
