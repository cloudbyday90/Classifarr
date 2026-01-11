const db = require('../../config/database');
const request = require('supertest');
const express = require('express');
const policiesRouter = require('../../routes/policies');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/policies', policiesRouter);

describe('Policies API Integration Tests', () => {
    let testLibraryId;
    let testPolicyId;
    let testPresetIds = [];

    // Setup test data before all tests
    beforeAll(async () => {
        // Create a test library
        const libraryResult = await db.query(`
            INSERT INTO libraries (name, media_type, is_active, priority)
            VALUES ('Test Library', 'movie', true, 5)
            RETURNING id
        `);
        testLibraryId = libraryResult.rows[0].id;

        // Get some test presets
        const presetsResult = await db.query(`
            SELECT id FROM content_presets WHERE is_system = true LIMIT 5
        `);
        testPresetIds = presetsResult.rows.map(r => r.id);
    });

    // Clean up after all tests
    afterAll(async () => {
        // Delete test policy (cascade will handle policy_presets)
        if (testPolicyId) {
            await db.query('DELETE FROM library_policies WHERE id = $1', [testPolicyId]);
        }
        // Delete test library
        if (testLibraryId) {
            await db.query('DELETE FROM libraries WHERE id = $1', [testLibraryId]);
        }
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
                preset_weight: 0.40,
                pattern_weight: 0.30,
                rag_weight: 0.20,
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

    describe('GET /api/presets/all', () => {
        test('should return all presets', async () => {
            const response = await request(app)
                .get('/api/presets/all')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });

        test('should filter by category', async () => {
            const response = await request(app)
                .get('/api/presets/all?category=audience')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(preset => {
                expect(preset.category).toBe('audience');
            });
        });

        test('should search presets', async () => {
            const response = await request(app)
                .get('/api/presets/all?search=family')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            response.body.forEach(preset => {
                const searchTerm = preset.name.toLowerCase() + ' ' + (preset.description || '').toLowerCase();
                expect(searchTerm).toContain('family');
            });
        });
    });

    describe('GET /api/presets/categories', () => {
        test('should return preset categories with counts', async () => {
            const response = await request(app)
                .get('/api/presets/categories')
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

    describe('DELETE /api/policies/:id', () => {
        test('should delete policy', async () => {
            const response = await request(app)
                .delete(`/api/policies/${testPolicyId}`)
                .expect(200);

            expect(response.body.message).toContain('deleted');

            // Verify it's really deleted
            await request(app)
                .get(`/api/policies/${testPolicyId}`)
                .expect(404);

            // Clear testPolicyId so afterAll doesn't try to delete it again
            testPolicyId = null;
        });
    });
});
