import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { classificationProgressStageService } = await import('../../services/classificationProgressStageService.mjs');
const { createClassificationProgressRouter } = await import('../../routes/classificationProgressRouteShared.mjs');

const express = (await import('express')).default;

const app = createIntegrationTestApp({
    basePath: '/api/classification/progress',
    middleware: [authenticateToken],
    router: createClassificationProgressRouter({
        express,
        classificationProgressStageService,
    }),
});

describe('Classification Progress Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('progress_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'progress_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function seedTask(overrides = {}) {
        const defaults = {
            task_type: 'classification',
            status: 'processing',
            payload: JSON.stringify({ title: 'Test Movie', year: 2024, mediaType: 'movie' }),
            priority: 5,
        };
        const data = { ...defaults, ...overrides };

        const result = await db.query(`
            INSERT INTO task_queue (task_type, status, payload, priority, current_phase, phase_index, phase_started_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [data.task_type, data.status, data.payload, data.priority,
            data.current_phase || null,
            data.phase_index || null,
            data.phase_started_at || null]);
        return result.rows[0];
    }

    describe('GET /', () => {
        it('returns empty array when no active classifications', async () => {
            const res = await request(app)
                .get('/api/classification/progress')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('returns active classifications with progress', async () => {
            await seedTask({
                status: 'processing',
                current_phase: 'classification',
                phase_index: 3,
                phase_started_at: new Date().toISOString(),
            });

            const res = await request(app)
                .get('/api/classification/progress')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            if (res.body.length > 0) {
                expect(res.body[0]).toHaveProperty('taskId');
                expect(res.body[0]).toHaveProperty('currentStage');
                expect(res.body[0]).toHaveProperty('currentPhase');
                expect(res.body[0]).toHaveProperty('stages');
                expect(res.body[0]).toHaveProperty('progress');
            }
        });
    });

    describe('GET /:taskId', () => {
        it('returns progress for a specific task', async () => {
            const task = await seedTask({
                status: 'processing',
                current_phase: 'classification',
                phase_index: 3,
                phase_started_at: new Date().toISOString(),
            });

            const res = await request(app)
                .get(`/api/classification/progress/${task.id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.taskId).toBe(task.id);
            expect(res.body.currentStage).toBe('classification');
            expect(res.body.currentPhase).toBe('classification');
            expect(res.body.stageIndex).toBe(3);
            expect(res.body.phaseIndex).toBe(3);
            expect(res.body.status).toBe('processing');
        });

        it('returns 404 for non-existent task', async () => {
            const res = await request(app)
                .get('/api/classification/progress/999999')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Task not found or not processing');
        });
    });
});
