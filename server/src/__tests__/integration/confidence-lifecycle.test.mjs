import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { confidenceCalculator } = await import('../../services/confidenceCalculator.mjs');
const { SIGNAL_TYPES } = await import('../../services/signalCollector.mjs');
const { createConfidenceRouter } = await import('../../routes/confidenceRouteShared.mjs');

const express = (await import('express')).default;

const CONFIDENCE_DDL = `
    CREATE TABLE IF NOT EXISTS confidence_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
`;

const app = createIntegrationTestApp({
    basePath: '/api/confidence',
    middleware: [authenticateToken],
    router: createConfidenceRouter({
        express,
        confidenceCalculator,
        signalTypes: SIGNAL_TYPES,
    }),
});

describe('Confidence Routes Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        await db.query(CONFIDENCE_DDL);

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('confidence_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'confidence_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM confidence_settings');
        confidenceCalculator.weights = confidenceCalculator.getDefaultWeights();
        confidenceCalculator.threshold = 80;
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    describe('GET /weights', () => {
        it('returns current weights, threshold, signal types, and defaults', async () => {
            const res = await request(app)
                .get('/api/confidence/weights')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.weights).toBeDefined();
            expect(res.body.threshold).toBe(80);
            expect(res.body.signalTypes).toBeDefined();
            expect(res.body.defaults).toBeDefined();
        });

        it('loads persisted weights from database', async () => {
            await db.query(`
                INSERT INTO confidence_settings (setting_key, setting_value)
                VALUES ('weight_exact_match', '50')
            `);

            const res = await request(app)
                .get('/api/confidence/weights')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.weights.exact_match).toBe(50);
        });
    });

    describe('PUT /weights', () => {
        it('saves new weights', async () => {
            const newWeights = { exact_match: 30, genre_match: 20 };

            const res = await request(app)
                .put('/api/confidence/weights')
                .set(authHeaders())
                .send({ weights: newWeights });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.weights.exact_match).toBe(30);

            const dbCheck = await db.query("SELECT * FROM confidence_settings WHERE setting_key = 'weight_exact_match'");
            expect(dbCheck.rows).toHaveLength(1);
            expect(dbCheck.rows[0].setting_value).toBe('30');
        });

        it('returns 400 for invalid weights object', async () => {
            const res = await request(app)
                .put('/api/confidence/weights')
                .set(authHeaders())
                .send({ weights: 'not-an-object' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid weights object');
        });

        it('returns 400 for weight outside valid range', async () => {
            const res = await request(app)
                .put('/api/confidence/weights')
                .set(authHeaders())
                .send({ weights: { exact_match: 150 } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid weight');
        });

        it('returns 400 for non-numeric weight', async () => {
            const res = await request(app)
                .put('/api/confidence/weights')
                .set(authHeaders())
                .send({ weights: { exact_match: 'high' } });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid weight');
        });
    });

    describe('PUT /threshold', () => {
        it('saves a new threshold', async () => {
            const res = await request(app)
                .put('/api/confidence/threshold')
                .set(authHeaders())
                .send({ threshold: 75 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.threshold).toBe(75);

            const dbCheck = await db.query("SELECT * FROM confidence_settings WHERE setting_key = 'confidence_threshold'");
            expect(dbCheck.rows).toHaveLength(1);
            expect(dbCheck.rows[0].setting_value).toBe('75');
        });

        it('returns 400 for non-numeric threshold', async () => {
            const res = await request(app)
                .put('/api/confidence/threshold')
                .set(authHeaders())
                .send({ threshold: 'high' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Threshold must be a number');
        });

        it('returns 400 for threshold outside valid range', async () => {
            const res = await request(app)
                .put('/api/confidence/threshold')
                .set(authHeaders())
                .send({ threshold: 150 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Threshold must be a number between 0 and 100');
        });
    });

    describe('POST /reset', () => {
        it('resets weights and threshold to defaults', async () => {
            await db.query(`INSERT INTO confidence_settings (setting_key, setting_value) VALUES ('weight_exact_match', '10')`);
            await db.query(`INSERT INTO confidence_settings (setting_key, setting_value) VALUES ('confidence_threshold', '50')`);

            const res = await request(app)
                .post('/api/confidence/reset')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.threshold).toBe(80);
            expect(res.body.weights).toBeDefined();
        });
    });
});
