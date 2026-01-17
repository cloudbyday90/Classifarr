const request = require('supertest');
const express = require('express');
const db = require('../../config/database');
const statsRouter = require('../../routes/stats');

const app = express();
app.use(express.json());
app.use('/api/stats', statsRouter);

describe('Stats API Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testMediaServerId;
    let testUserId;

    beforeAll(async () => {
        // Create test user
        const userRes = await db.query(`
            INSERT INTO users (username, password_hash, role)
            VALUES ('test-stats-user', 'hash', 'admin')
            RETURNING id
        `);
        testUserId = userRes.rows[0].id;

        // Create test media server
        const serverRes = await db.query(`
            INSERT INTO media_server (type, name, url, api_key)
            VALUES ('plex', 'Test Stats Server', 'http://localhost:32400', 'test-key')
            RETURNING id
        `);
        testMediaServerId = serverRes.rows[0].id;

        // Create test library
        const libRes = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active)
            VALUES ($1, 'test-stats-lib-' || gen_random_uuid()::text, 'Test Stats Library', 'movie', true)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libRes.rows[0].id;

        // Create test policy
        const policyRes = await db.query(`
            INSERT INTO library_policies (library_id, name, enabled)
            VALUES ($1, 'Test Stats Policy', true)
            RETURNING id
        `, [testLibraryId]);
        testPolicyId = policyRes.rows[0].id;

        // Insert some test feedback data
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

        // Create initial stats
        await db.query(`
            INSERT INTO policy_learning_stats (
                policy_id, total_decisions, auto_classified, accuracy_rate,
                last_7_days_accuracy, trend
            ) VALUES ($1, 4, 3, 0.75, 0.8, 'improving')
        `, [testPolicyId]);

        // Create a discovered pattern
        await db.query(`
            INSERT INTO discovered_patterns (
                pattern_type, pattern_value, library_id, library_name, confidence, status
            ) VALUES ('genre', 'Action', $1, 'Test Stats Library', 85, 'approved')
        `, [testLibraryId]);

        // Create a tuning suggestion
        await db.query(`
            INSERT INTO policy_tuning_suggestions (
                policy_id, suggestion_type, suggestion_config, confidence, status
            ) VALUES ($1, 'adjust_threshold', '{"threshold_type": "auto_classify"}', 75, 'pending')
        `, [testPolicyId]);

        // Insert test classification history data for method stats
        await db.query(`
            INSERT INTO classification_history (
                tmdb_id, media_type, title, library_id, confidence, method, status
            ) VALUES
            (11111, 'movie', 'Test Classification 1', $1, 95, 'exact_match', 'completed'),
            (11112, 'movie', 'Test Classification 2', $1, 85, 'exact_match', 'completed'),
            (11113, 'movie', 'Test Classification 3', $1, 75, 'learned_pattern', 'completed'),
            (11114, 'movie', 'Test Classification 4', $1, 90, 'ai_fallback', 'completed'),
            (11115, 'movie', 'Test Classification 5', $1, 80, 'rule_match', 'completed')
        `, [testLibraryId]);
    });

    afterAll(async () => {
        // Clean up test data
        await db.query('DELETE FROM classification_history WHERE library_id = $1', [testLibraryId]);
        await db.query('DELETE FROM policy_tuning_suggestions WHERE policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM discovered_patterns WHERE library_id = $1', [testLibraryId]);
        await db.query('DELETE FROM policy_learning_stats WHERE policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id = $1', [testPolicyId]);
        await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        await db.query('DELETE FROM media_server WHERE id = $1', [testMediaServerId]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    describe('GET /api/stats/overview', () => {
        it('should return global stats overview', async () => {
            const res = await request(app)
                .get('/api/stats/overview')
                .expect(200);

            expect(res.body).toHaveProperty('total_policies');
            expect(res.body).toHaveProperty('total_decisions');
            expect(res.body).toHaveProperty('avg_accuracy');
            expect(res.body).toHaveProperty('improving_count');
            expect(res.body).toHaveProperty('auto_rate');
        });
    });

    describe('GET /api/stats', () => {
        it('should return overall stats with byMethod breakdown', async () => {
            const res = await request(app)
                .get('/api/stats')
                .expect(200);

            // Check overall stats
            expect(res.body).toHaveProperty('total');
            expect(res.body).toHaveProperty('avg_confidence');
            expect(res.body).toHaveProperty('high_confidence');
            expect(res.body).toHaveProperty('low_confidence');

            // Check byMethod array exists and has correct structure
            expect(res.body).toHaveProperty('byMethod');
            expect(Array.isArray(res.body.byMethod)).toBe(true);
            
            if (res.body.byMethod.length > 0) {
                const methodItem = res.body.byMethod[0];
                expect(methodItem).toHaveProperty('method');
                expect(methodItem).toHaveProperty('count');
                expect(methodItem).toHaveProperty('avg_confidence');
                
                // Verify it's sorted by count (descending)
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
                .expect(404);

            expect(res.body).toHaveProperty('error');
        });
    });

    describe('GET /api/stats/live-feed', () => {
        it('should return recent activity feed', async () => {
            const res = await request(app)
                .get('/api/stats/live-feed')
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
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeLessThanOrEqual(2);
        });
    });

    describe('GET /api/stats/alerts', () => {
        it('should return alerts for abnormal metrics', async () => {
            const res = await request(app)
                .get('/api/stats/alerts')
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
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
            
            const last7Days = res.body.find(p => p.period === 'last_7_days');
            const previous7Days = res.body.find(p => p.period === 'previous_7_days');
            
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
