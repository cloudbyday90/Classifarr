import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { clarificationService } = await import('../../services/clarificationService.mjs');
const { createClarificationRouter } = await import('../../routes/clarificationRouteShared.mjs');

const express = (await import('express')).default;

const CLARIFICATION_DDLS = [
    `CREATE TABLE IF NOT EXISTS confidence_thresholds (
        id SERIAL PRIMARY KEY,
        tier VARCHAR(20) NOT NULL UNIQUE,
        min_confidence INT NOT NULL,
        max_confidence INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS clarification_questions (
        id SERIAL PRIMARY KEY,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50) NOT NULL,
        trigger_keywords TEXT[],
        trigger_genres TEXT[],
        response_options JSONB NOT NULL,
        priority INT DEFAULT 0,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS clarification_responses (
        id SERIAL PRIMARY KEY,
        classification_id BIGINT,
        question_id INT,
        discord_user_id VARCHAR(100),
        response_value VARCHAR(100),
        response_label VARCHAR(255),
        confidence_before INT,
        confidence_after INT,
        created_at TIMESTAMP DEFAULT NOW()
    )`,
];

const app = createIntegrationTestApp({
    basePath: '/api/clarifications',
    middleware: [authenticateToken],
    router: createClarificationRouter({
        express,
        clarificationService,
        db,
    }),
});

describe('Clarification Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        for (const ddl of CLARIFICATION_DDLS) {
            await db.query(ddl);
        }

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('clarification_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'clarification_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM clarification_responses');
        await db.query('DELETE FROM clarification_questions');
        await db.query('DELETE FROM confidence_thresholds');
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function seedThreshold(overrides = {}) {
        const defaults = {
            tier: 'clarify',
            min_confidence: 50,
            max_confidence: 69,
            action: 'clarify_questions',
            description: 'Requires clarification',
        };
        const data = { ...defaults, ...overrides };

        const result = await db.query(`
            INSERT INTO confidence_thresholds (tier, min_confidence, max_confidence, action, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (tier) DO UPDATE SET min_confidence = $2, max_confidence = $3
            RETURNING *
        `, [data.tier, data.min_confidence, data.max_confidence, data.action, data.description]);
        return result.rows[0];
    }

    async function seedQuestion(overrides = {}) {
        const defaults = {
            question_text: 'Is this an anime?',
            question_type: 'genre',
            trigger_keywords: ['anime'],
            trigger_genres: ['Animation'],
            response_options: JSON.stringify([
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
            ]),
            priority: 5,
            enabled: true,
        };
        const data = { ...defaults, ...overrides };

        const result = await db.query(`
            INSERT INTO clarification_questions
                (question_text, question_type, trigger_keywords, trigger_genres, response_options, priority, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [data.question_text, data.question_type, data.trigger_keywords, data.trigger_genres,
            data.response_options, data.priority, data.enabled]);
        return result.rows[0];
    }

    describe('GET /settings/confidence', () => {
        it('returns empty array when no thresholds exist', async () => {
            const res = await request(app)
                .get('/api/clarifications/settings/confidence')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns configured thresholds', async () => {
            await seedThreshold({ tier: 'auto', min_confidence: 70, max_confidence: 100, action: 'auto_route' });
            await seedThreshold({ tier: 'clarify', min_confidence: 50, max_confidence: 69, action: 'clarify_questions' });

            const res = await request(app)
                .get('/api/clarifications/settings/confidence')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });
    });

    describe('PUT /settings/confidence/:tier', () => {
        it('updates a threshold tier', async () => {
            await seedThreshold({ tier: 'clarify', min_confidence: 50, max_confidence: 69 });

            const res = await request(app)
                .put('/api/clarifications/settings/confidence/clarify')
                .set(authHeaders())
                .send({ min_confidence: 40, max_confidence: 65 });

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        });
    });

    describe('GET /settings/questions', () => {
        it('returns empty array when no questions exist', async () => {
            const res = await request(app)
                .get('/api/clarifications/settings/questions')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns all questions', async () => {
            await seedQuestion({ question_text: 'Question 1' });
            await seedQuestion({ question_text: 'Question 2' });

            const res = await request(app)
                .get('/api/clarifications/settings/questions')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });
    });

    describe('POST /settings/questions', () => {
        it('creates a new question', async () => {
            const res = await request(app)
                .post('/api/clarifications/settings/questions')
                .set(authHeaders())
                .send({
                    question_text: 'Is this content appropriate?',
                    question_type: 'content',
                    trigger_keywords: [],
                    trigger_genres: [],
                    response_options: JSON.stringify([{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]),
                    priority: 5,
                    enabled: true,
                });

            expect(res.status).toBe(200);
            expect(res.body.question_text).toBe('Is this content appropriate?');
            expect(res.body.question_type).toBe('content');
        });

        it('returns 400 when question_text is missing', async () => {
            const res = await request(app)
                .post('/api/clarifications/settings/questions')
                .set(authHeaders())
                .send({ question_type: 'genre', response_options: [] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Missing required fields');
        });

        it('returns 400 when question_type is missing', async () => {
            const res = await request(app)
                .post('/api/clarifications/settings/questions')
                .set(authHeaders())
                .send({ question_text: 'Test?', response_options: [] });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Missing required fields');
        });

        it('returns 400 when response_options is missing', async () => {
            const res = await request(app)
                .post('/api/clarifications/settings/questions')
                .set(authHeaders())
                .send({ question_text: 'Test?', question_type: 'genre' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Missing required fields');
        });
    });

    describe('PUT /settings/questions/:id', () => {
        it('updates an existing question', async () => {
            const question = await seedQuestion({ question_text: 'Original' });

            const res = await request(app)
                .put(`/api/clarifications/settings/questions/${question.id}`)
                .set(authHeaders())
                .send({ question_text: 'Updated question' });

            expect(res.status).toBe(200);
            expect(res.body.question_text).toBe('Updated question');
        });
    });

    describe('DELETE /settings/questions/:id', () => {
        it('deletes an existing question', async () => {
            const question = await seedQuestion();

            const res = await request(app)
                .delete(`/api/clarifications/settings/questions/${question.id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const check = await db.query('SELECT * FROM clarification_questions WHERE id = $1', [question.id]);
            expect(check.rows).toHaveLength(0);
        });
    });

    describe('GET /:classificationId', () => {
        it('returns 404 when classification does not exist', async () => {
            const res = await request(app)
                .get('/api/clarifications/999999')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Classification not found');
        });

        it('returns policy question when classification has one', async () => {
            const result = await db.query(`
                INSERT INTO classification_history (title, media_type, method, status, tmdb_id)
                VALUES ('Test Movie', 'movie', 'exact_match', 'pending', 99999)
                RETURNING id
            `);
            const classificationId = result.rows[0].id;

            const policyQuestion = JSON.stringify({
                question: 'Which library?',
                options: [{ value: 'movies', label: 'Movies' }],
            });

            await db.query(
                'UPDATE classification_history SET policy_question = $1 WHERE id = $2',
                [policyQuestion, classificationId]
            );

            const res = await request(app)
                .get(`/api/clarifications/${classificationId}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].question).toBe('Which library?');
        });
    });

    describe('POST /:id/respond', () => {
        it('returns 400 when required fields are missing', async () => {
            const res = await request(app)
                .post('/api/clarifications/1/respond')
                .set(authHeaders())
                .send({ classificationId: 1 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Missing required fields');
        });
    });
});
