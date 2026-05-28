import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { createLogger } = await import('../../utils/logger.mjs');
const { createSchedulerRouter } = await import('../../routes/schedulerRouteShared.mjs');
const { schedulerService } = await import('../../services/schedulerService.mjs');

const express = (await import('express')).default;
const _logger = createLogger('scheduler-integration-test');

const SCHEDULER_SERVICE_DDL = `
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        task_type VARCHAR(50) DEFAULT 'library_scan' NOT NULL,
        library_id INTEGER,
        cron_expression VARCHAR(100),
        interval_minutes INTEGER,
        enabled BOOLEAN DEFAULT true,
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        run_count INTEGER DEFAULT 0,
        last_result JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
`;

const app = createIntegrationTestApp({
    basePath: '/api/scheduler',
    middleware: [authenticateToken],
    router: createSchedulerRouter({
        express,
        schedulerService,
    }),
});

describe('Scheduler Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        await db.query(SCHEDULER_SERVICE_DDL);

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('scheduler_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'scheduler_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        schedulerService.resetState();
    });

    beforeEach(async () => {
        await db.query('DELETE FROM scheduled_tasks');
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function seedTask(overrides = {}) {
        const defaults = {
            name: 'Test Task',
            task_type: 'library_scan',
            interval_minutes: 60,
            enabled: true,
        };
        const data = { ...defaults, ...overrides };

        const result = await db.query(`
            INSERT INTO scheduled_tasks (name, task_type, library_id, interval_minutes, enabled)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [data.name, data.task_type, data.library_id || null, data.interval_minutes, data.enabled]);
        return result.rows[0];
    }

    describe('GET / — list tasks', () => {
        it('returns empty array when no tasks exist', async () => {
            const res = await request(app)
                .get('/api/scheduler')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns all scheduled tasks', async () => {
            await seedTask({ name: 'Task 1' });
            await seedTask({ name: 'Task 2', task_type: 'cleanup_logs', interval_minutes: 1440 });

            const res = await request(app)
                .get('/api/scheduler')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });
    });

    describe('GET /:id', () => {
        it('returns a single task by id', async () => {
            const task = await seedTask({ name: 'Specific Task' });

            const res = await request(app)
                .get(`/api/scheduler/${task.id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(task.id);
            expect(res.body.name).toBe('Specific Task');
        });

        it('returns 404 for non-existent task', async () => {
            const res = await request(app)
                .get('/api/scheduler/999999')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Task not found');
        });
    });

    describe('POST / — create task', () => {
        it('creates a new scheduled task', async () => {
            const res = await request(app)
                .post('/api/scheduler')
                .set(authHeaders())
                .send({
                    name: 'New Task',
                    task_type: 'library_scan',
                    interval_minutes: 30,
                    enabled: true,
                });

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('New Task');
            expect(res.body.task_type).toBe('library_scan');
            expect(res.body.interval_minutes).toBe(30);
            expect(res.body.enabled).toBe(true);
        });

        it('returns 400 when name is missing', async () => {
            const res = await request(app)
                .post('/api/scheduler')
                .set(authHeaders())
                .send({ task_type: 'library_scan', interval_minutes: 30 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('name and task_type are required');
        });

        it('returns 400 when task_type is missing', async () => {
            const res = await request(app)
                .post('/api/scheduler')
                .set(authHeaders())
                .send({ name: 'Task', interval_minutes: 30 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('name and task_type are required');
        });

        it('returns 400 when interval_minutes is too small', async () => {
            const res = await request(app)
                .post('/api/scheduler')
                .set(authHeaders())
                .send({ name: 'Task', task_type: 'library_scan', interval_minutes: 2 });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('interval_minutes must be at least 5');
        });
    });

    describe('PUT /:id', () => {
        it('updates an existing task', async () => {
            const task = await seedTask({ name: 'Original' });

            const res = await request(app)
                .put(`/api/scheduler/${task.id}`)
                .set(authHeaders())
                .send({ name: 'Updated', interval_minutes: 120 });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated');
            expect(res.body.interval_minutes).toBe(120);
        });

        it('returns 404 for non-existent task', async () => {
            const res = await request(app)
                .put('/api/scheduler/999999')
                .set(authHeaders())
                .send({ name: 'Updated' });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Task not found');
        });

        it('toggles enabled status', async () => {
            const task = await seedTask({ enabled: true });

            const res = await request(app)
                .put(`/api/scheduler/${task.id}`)
                .set(authHeaders())
                .send({ enabled: false });

            expect(res.status).toBe(200);
            expect(res.body.enabled).toBe(false);
        });
    });

    describe('DELETE /:id', () => {
        it('deletes an existing task', async () => {
            const task = await seedTask({ name: 'To Delete' });

            const res = await request(app)
                .delete(`/api/scheduler/${task.id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const check = await db.query('SELECT * FROM scheduled_tasks WHERE id = $1', [task.id]);
            expect(check.rows).toHaveLength(0);
        });
    });

    describe('POST /:id/run', () => {
        it('returns 404 for non-existent task', async () => {
            const res = await request(app)
                .post('/api/scheduler/999999/run')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Task not found');
        });
    });
});
