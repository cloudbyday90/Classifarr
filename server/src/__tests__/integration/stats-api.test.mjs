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
const authService = await import('../../services/auth.mjs');
const { policyOverlapMetricsCollector } = await import('../../services/policyOverlapMetricsCollector.mjs');
const { policyOverlapMetricsSnapshotService } = await import('../../services/policyOverlapMetricsSnapshotService.mjs');
const { router: statsRouter } = await import('../../routes/stats.mjs');
const app = createIntegrationTestApp({
    basePath: '/api/stats',
    router: statsRouter,
});

describe('Stats API Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testMediaServerId;
    let testUserId;
    let testToken;

    beforeAll(async () => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS policy_overlap_metrics_snapshots (
                id BIGSERIAL PRIMARY KEY,
                session_id UUID NOT NULL,
                session_started_at TIMESTAMPTZ NOT NULL,
                snapshot_reason VARCHAR(64) NOT NULL DEFAULT 'periodic',
                decision_delta INTEGER NOT NULL DEFAULT 0,
                total_decisions INTEGER NOT NULL DEFAULT 0,
                weak_evidence_primary_count INTEGER NOT NULL DEFAULT 0,
                weak_evidence_overlap_count INTEGER NOT NULL DEFAULT 0,
                manual_review_recommended_count INTEGER NOT NULL DEFAULT 0,
                actions JSONB NOT NULL DEFAULT '{}'::jsonb,
                primary_viability_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
                top_overlap_pairs JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        const userRes = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('test-stats-user', 'hash', 'admin', true)
            RETURNING id
        `);
        testUserId = userRes.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'test-stats-user',
            role: 'admin'
        });

        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Stats Server', 'http://localhost:32400', 'test-key')
            RETURNING id
        `);
        testMediaServerId = serverRes.rows[0].id;

        const libRes = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
            VALUES ($1, 'test-stats-lib-' || gen_random_uuid()::text, 'Test Stats Library', 'movie', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes.rows[0].id;

        const policyRes = await db.query(`
            INSERT INTO library_policies (library_id, name, enabled)
            VALUES ($1, 'Test Stats Policy', true)
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes.rows[0].id;

        await db.query(`
            INSERT INTO policy_feedback_log (
                tmdb_id, media_type, title, item_metadata, prompt_type,
                selected_library_id, selected_policy_id, was_correction, prompted_at
            ) VALUES
            (12345, 'movie', 'Test Movie 1', '{}', 'auto_classify', $1, $2, false, NOW() - INTERVAL '1 day'),
            (12346, 'movie', 'Test Movie 2', '{}', 'auto_classify', $1, $2, false, NOW() - INTERVAL '2 days'),
            (12347, 'movie', 'Test Movie 3', '{}', 'prompt_confirm', $1, $2, true, NOW() - INTERVAL '3 days'),
            (12348, 'movie', 'Test Movie 4', '{}', 'auto_classify', $1, $2, false, NOW() - INTERVAL '4 days')
        `, [testLibraryId, testPolicyId]);

        await db.query(`
            INSERT INTO policy_learning_stats (
                policy_id, total_decisions, auto_classified, accuracy_rate,
                last_7_days_accuracy, trend
            ) VALUES ($1, 4, 3, 0.75, 0.8, 'improving')
        `, [testPolicyId]);

        await db.query(`
            INSERT INTO discovered_patterns (
                pattern_type, pattern_value, library_id, library_name, confidence, status
            ) VALUES ('genre', 'Action', $1, 'Test Stats Library', 85, 'approved')
        `, [testLibraryId]);

        await db.query(`
            INSERT INTO policy_tuning_suggestions (
                policy_id, suggestion_type, suggestion_config, confidence, status
            ) VALUES ($1, 'adjust_threshold', '{"threshold_type": "auto_classify"}', 75, 'pending')
        `, [testPolicyId]);

        await db.query(`
            INSERT INTO classification_history (
                tmdb_id, media_type, title, library_id, confidence, method, status, metadata, created_at
            ) VALUES
            (11111, 'movie', 'Test Classification 1', $1, 95, 'exact_match', 'completed', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '1 day'),
            (11112, 'movie', 'Test Classification 2', $1, 85, 'exact_match', 'completed', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '1 day'),
            (11113, 'movie', 'Test Classification 3', $1, 75, 'learned_pattern', 'completed', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '1 day'),
            (11114, 'movie', 'Test Classification 4', $1, 90, 'ai_fallback', 'completed', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '1 day'),
            (11115, 'movie', 'Test Classification 5', $1, 80, 'rule_match', 'completed', '{}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '1 day'),
            (11116, 'movie', 'Private Verification Test Item', $1, 90, 'ai_verified', 'completed',
             '{"classification_details":{"candidate_bound_verification":{"version":"classification.candidate_bound_verification.v1","status_id":"confirmed"}}}'::jsonb, CURRENT_TIMESTAMP - INTERVAL '1 day')
        `, [testLibraryId]);
    });

    afterAll(async () => {
        await db.query('DELETE FROM classification_history WHERE library_id = $1', [testLibraryId]);
        await db.query('DELETE FROM policy_tuning_suggestions WHERE policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM discovered_patterns WHERE library_id = $1', [testLibraryId]);
        await db.query('DELETE FROM policy_learning_stats WHERE policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM policy_overlap_metrics_snapshots');
        await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        await db.query('DELETE FROM media_server WHERE id = $1', [testMediaServerId]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    describe('GET /api/stats/overview', () => {
        it('should return global stats overview', async () => {
            policyOverlapMetricsCollector.reset();
            policyOverlapMetricsCollector.recordDecision({
                action: 'manual',
                ranked: [
                    {
                        library_id: testLibraryId,
                        library_name: 'Test Stats Library',
                        policy_id: testPolicyId,
                        policy_name: 'Test Stats Policy',
                        candidate_diagnostics: { primary_viability: 'compatibility_only' },
                    },
                    {
                        library_id: testLibraryId + 1,
                        library_name: 'Second Stats Library',
                        policy_id: testPolicyId + 1,
                        policy_name: 'Second Stats Policy',
                        candidate_diagnostics: { primary_viability: 'profile_only' },
                    },
                ],
                candidateDiagnostics: { primary_viability: 'compatibility_only' },
                decisionDiagnostics: {
                    requires_manual_review: true,
                    reason_code: 'weak_evidence_overlap',
                },
            });
            policyOverlapMetricsSnapshotService.resetRuntimeState();
            await policyOverlapMetricsSnapshotService.persistSnapshot({ force: true, reason: 'integration_test' });

            const res = await request(app)
                .get('/api/stats/overview')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('total_policies');
            expect(res.body).toHaveProperty('total_decisions');
            expect(res.body).toHaveProperty('avg_accuracy');
            expect(res.body).toHaveProperty('improving_count');
            expect(res.body).toHaveProperty('auto_rate');
            expect(res.body).toHaveProperty('policy_overlap_metrics');
            expect(res.body).toHaveProperty('policy_overlap_metrics_latest_snapshot');
            expect(res.body.policy_overlap_metrics).toEqual(expect.objectContaining({
                total_decisions: 1,
                weak_evidence_overlap_count: 1,
            }));
            expect(res.body.policy_overlap_metrics_latest_snapshot).toEqual(expect.objectContaining({
                snapshot_reason: 'integration_test',
                weak_evidence_overlap_count: 1,
            }));
        });
    });

    describe('GET /api/stats/candidate-bound-verification', () => {
        it('should return only the authenticated aggregate verification report', async () => {
            const res = await request(app)
                .get('/api/stats/candidate-bound-verification?days=7')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(res.body).toMatchObject({
                version: 'classification.candidate_bound_verification_metrics.v1',
                current: {
                    statusCounts: expect.arrayContaining([
                        expect.objectContaining({ statusId: 'confirmed', count: expect.any(Number) }),
                    ]),
                },
                driftGuard: expect.objectContaining({ statusId: expect.any(String) }),
            });
            expect(JSON.stringify(res.body)).not.toContain('Private Verification Test Item');
            expect(JSON.stringify(res.body)).not.toContain('Test Stats Library');
        });
    });

    describe('GET /api/stats/policies/overlap-history', () => {
        it('should return recent persisted overlap snapshots', async () => {
            policyOverlapMetricsCollector.reset();
            policyOverlapMetricsSnapshotService.resetRuntimeState();
            policyOverlapMetricsCollector.recordDecision({
                action: 'prompt_select',
                ranked: [{
                    library_id: testLibraryId,
                    library_name: 'Test Stats Library',
                    policy_id: testPolicyId,
                    policy_name: 'Test Stats Policy',
                    candidate_diagnostics: { primary_viability: 'profile_only' },
                }],
                candidateDiagnostics: { primary_viability: 'profile_only' },
                decisionDiagnostics: {
                    requires_manual_review: true,
                    reason_code: 'weak_evidence_primary',
                },
            });
            await policyOverlapMetricsSnapshotService.persistSnapshot({ force: true, reason: 'history_test' });

            const res = await request(app)
                .get('/api/stats/policies/overlap-history?limit=5')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0]).toEqual(expect.objectContaining({
                snapshot_reason: 'history_test',
                weak_evidence_primary_count: 1,
            }));
        });
    });

    describe('GET /api/stats', () => {
        it('should return overall stats with byMethod breakdown', async () => {
            const res = await request(app)
                .get('/api/stats')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('total');
            expect(res.body).toHaveProperty('avg_confidence');
            expect(res.body).toHaveProperty('high_confidence');
            expect(res.body).toHaveProperty('low_confidence');
            expect(res.body).toHaveProperty('byMethod');
            expect(Array.isArray(res.body.byMethod)).toBe(true);

            if (res.body.byMethod.length > 0) {
                const methodItem = res.body.byMethod[0];
                expect(methodItem).toHaveProperty('method');
                expect(methodItem).toHaveProperty('count');
                expect(methodItem).toHaveProperty('avg_confidence');

                if (res.body.byMethod.length > 1) {
                    expect(Number(res.body.byMethod[0].count))
                        .toBeGreaterThanOrEqual(Number(res.body.byMethod[1].count));
                }
            }
        });
    });

    describe('GET /api/stats/policies/:id', () => {
        it('should return detailed stats for a policy', async () => {
            const res = await request(app)
                .get(`/api/stats/policies/${testPolicyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('policy_id', testPolicyId);
            expect(res.body).toHaveProperty('total_decisions');
            expect(res.body).toHaveProperty('accuracy_rate');
            expect(res.body).toHaveProperty('time_series');
            expect(res.body).toHaveProperty('prompt_breakdown');
            expect(Array.isArray(res.body.time_series)).toBe(true);
            expect(Array.isArray(res.body.prompt_breakdown)).toBe(true);
        });

        it('should return 404 for non-existent policy', async () => {
            const res = await request(app)
                .get('/api/stats/policies/999999')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(404);

            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/stats/live-feed', () => {
        it('should return recent activity feed', async () => {
            const res = await request(app)
                .get('/api/stats/live-feed')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);

            if (res.body.length > 0) {
                const item = res.body[0];
                expect(item).toHaveProperty('type');
                expect(item).toHaveProperty('id');
                expect(item).toHaveProperty('created_at');
                expect(['decision', 'pattern', 'suggestion']).toContain(item.type);
            }
        });

        it('should respect limit parameter', async () => {
            const res = await request(app)
                .get('/api/stats/live-feed?limit=2')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeLessThanOrEqual(2);
        });
    });

    describe('GET /api/stats/alerts', () => {
        it('should return alerts for abnormal metrics', async () => {
            const res = await request(app)
                .get('/api/stats/alerts')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);

            if (res.body.length > 0) {
                const alert = res.body[0];
                expect(alert).toHaveProperty('type');
                expect(alert).toHaveProperty('severity');
                expect(alert).toHaveProperty('message');
                expect(['warning', 'info']).toContain(alert.severity);
            }
        });
    });

    describe('GET /api/stats/policies/:id/compare', () => {
        it('should return period comparison data', async () => {
            const res = await request(app)
                .get(`/api/stats/policies/${testPolicyId}/compare`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);

            const last7Days = res.body.find((period) => period.period === 'last_7_days');
            const previous7Days = res.body.find((period) => period.period === 'previous_7_days');

            if (last7Days) {
                expect(last7Days).toHaveProperty('decisions');
                expect(last7Days).toHaveProperty('accuracy');
                expect(last7Days).toHaveProperty('auto_rate');
            }

            if (previous7Days) {
                expect(previous7Days).toHaveProperty('decisions');
                expect(previous7Days).toHaveProperty('accuracy');
                expect(previous7Days).toHaveProperty('auto_rate');
            }
        });
    });

    describe('GET /api/stats/policies', () => {
        it('should return all policies with their stats', async () => {
            const res = await request(app)
                .get('/api/stats/policies')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);

            if (res.body.length > 0) {
                const policy = res.body[0];
                expect(policy).toHaveProperty('id');
                expect(policy).toHaveProperty('name');
                expect(policy).toHaveProperty('library_id');
            }
        });
    });
});
