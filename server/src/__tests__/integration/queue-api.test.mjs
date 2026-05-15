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
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createNamedServiceStub } from '../helpers/mockFactory.mjs';

const { service: ollamaService, module: ollamaServiceModule } = createNamedServiceStub('ollamaService', ['getGenerationStatus']);
ollamaService.getGenerationStatus.mockReturnValue({
    isGenerating: false,
    model: null,
    tokens: 0,
    currentItem: null,
});

const { service: enrichmentRetryService, module: enrichmentRetryServiceModule } = createNamedServiceStub('enrichmentRetryService', [
    'getStats',
    'processRetryQueue',
    'backfillRetryQueue',
]);
enrichmentRetryService.getStats.mockResolvedValue({ tavily: { pending: 0 }, total: { pending: 0 } });
enrichmentRetryService.processRetryQueue.mockResolvedValue({ processed: 0 });
enrichmentRetryService.backfillRetryQueue.mockResolvedValue({ queued: 0 });

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
jest.unstable_mockModule('../../services/ollama.mjs', () => ollamaServiceModule);
jest.unstable_mockModule('../../services/enrichmentRetryService.mjs', () => enrichmentRetryServiceModule);

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { router: queueRouter } = await import('../../routes/queue.mjs');
const app = express();
app.use(express.json());
app.use('/api/queue', queueRouter);

describe('Queue API Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('queuetest_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'queuetest_user',
            role: 'admin'
        });
    });

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM classification_history');
        await db.query('DELETE FROM task_queue');
    });

    async function insertTask(status, taskType = 'classification') {
        const result = await db.query(`
            INSERT INTO task_queue (task_type, status, priority, payload, source, max_attempts)
            VALUES ($1, $2, 5, '{"title":"Test Movie"}', 'webhook', 5)
            RETURNING id
        `, [taskType, status]);
        return result.rows[0].id;
    }

    async function insertClassificationOutcome(status) {
        const title = `Outcome ${status} ${Date.now()} ${Math.random()}`;
        await db.query(
            `
                INSERT INTO classification_history (
                    media_type,
                    title,
                    method,
                    status
                )
                VALUES ('movie', $1, 'ai_analysis', $2)
            `,
            [title, status]
        );
    }

    describe('GET /api/queue/stats', () => {
        test('should return zero stats for empty queue', async () => {
            const response = await request(app)
                .get('/api/queue/stats')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('pending');
            expect(response.body).toHaveProperty('failed');
            expect(response.body).toHaveProperty('total');
            expect(response.body.pending).toBe(0);
            expect(response.body.total).toBe(0);
        });

        test('should combine active queue rows with durable classification outcomes', async () => {
            await insertTask('pending');
            await insertTask('pending');
            await insertClassificationOutcome('failed');
            await insertClassificationOutcome('routed');

            const response = await request(app)
                .get('/api/queue/stats')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.pending).toBe(2);
            expect(response.body.failed).toBe(1);
            expect(response.body.completed).toBe(1);
            expect(response.body.total).toBe(4);
        });

        test('should only count classification tasks (not metadata_enrichment)', async () => {
            await insertTask('pending', 'classification');
            await insertTask('pending', 'metadata_enrichment');

            const response = await request(app)
                .get('/api/queue/stats')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.pending).toBe(1);
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/queue/stats')
                .expect(401);
        });
    });

    describe('GET /api/queue/pending', () => {
        test('should return empty array when no pending tasks', async () => {
            const response = await request(app)
                .get('/api/queue/pending')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        test('should return pending and processing tasks', async () => {
            await insertTask('pending');
            await insertTask('processing');
            await insertTask('failed');

            const response = await request(app)
                .get('/api/queue/pending')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.length).toBe(2);
            const statuses = response.body.map(t => t.status);
            expect(statuses).toContain('pending');
            expect(statuses).toContain('processing');
            expect(statuses).not.toContain('failed');
        });

        test('should respect the limit query parameter', async () => {
            for (let i = 0; i < 5; i++) {
                await insertTask('pending');
            }

            const response = await request(app)
                .get('/api/queue/pending?limit=3')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.length).toBe(3);
        });

        test('should include expected fields in each task', async () => {
            await insertTask('pending');

            const response = await request(app)
                .get('/api/queue/pending')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            const task = response.body[0];
            expect(task).toHaveProperty('id');
            expect(task).toHaveProperty('task_type');
            expect(task).toHaveProperty('status');
            expect(task).toHaveProperty('priority');
            expect(task).toHaveProperty('created_at');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/queue/pending')
                .expect(401);
        });
    });

    describe('GET /api/queue/failed', () => {
        test('should return empty array when no failed tasks', async () => {
            const response = await request(app)
                .get('/api/queue/failed')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        test('should return only failed tasks', async () => {
            await insertTask('failed');
            await insertTask('failed');
            await insertTask('pending');

            const response = await request(app)
                .get('/api/queue/failed')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.length).toBe(2);
            response.body.forEach(t => expect(t.status).toBe('failed'));
        });

        test('should respect the limit query parameter', async () => {
            for (let i = 0; i < 5; i++) {
                await insertTask('failed');
            }

            const response = await request(app)
                .get('/api/queue/failed?limit=2')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.length).toBe(2);
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/queue/failed')
                .expect(401);
        });
    });

    describe('POST /api/queue/task/:id/retry', () => {
        test('should reset a failed task back to pending', async () => {
            const taskId = await insertTask('failed');

            await db.query(
                `UPDATE task_queue SET error_message = 'AI unavailable', attempts = 3 WHERE id = $1`,
                [taskId]
            );

            const response = await request(app)
                .post(`/api/queue/task/${taskId}/retry`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            const check = await db.query('SELECT status, attempts, error_message FROM task_queue WHERE id = $1', [taskId]);
            expect(check.rows[0].status).toBe('pending');
            expect(check.rows[0].attempts).toBe(0);
            expect(check.rows[0].error_message).toBeNull();
        });

        test('should return 409 when retrying a task in the wrong state', async () => {
            const taskId = await insertTask('pending');

            const response = await request(app)
                .post(`/api/queue/task/${taskId}/retry`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(409);

            expect(response.body.code).toBe('invalid_state');
        });

        test('should return 401 without authentication', async () => {
            const taskId = await insertTask('failed');

            await request(app)
                .post(`/api/queue/task/${taskId}/retry`)
                .expect(401);
        });
    });

    describe('POST /api/queue/task/:id/dismiss', () => {
        test('should delete a failed task from the queue', async () => {
            const taskId = await insertTask('failed');

            const response = await request(app)
                .post(`/api/queue/task/${taskId}/dismiss`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            const check = await db.query('SELECT id FROM task_queue WHERE id = $1', [taskId]);
            expect(check.rows.length).toBe(0);
        });

        test('should return success=false when task does not exist', async () => {
            const response = await request(app)
                .post('/api/queue/task/999999/dismiss')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(404);

            expect(response.body.code).toBe('not_found');
        });

        test('should return 401 without authentication', async () => {
            const taskId = await insertTask('failed');

            await request(app)
                .post(`/api/queue/task/${taskId}/dismiss`)
                .expect(401);
        });
    });

    describe('POST /api/queue/task/:id/cancel', () => {
        test('should cancel a pending task', async () => {
            const taskId = await insertTask('pending');

            const response = await request(app)
                .post(`/api/queue/task/${taskId}/cancel`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            const check = await db.query('SELECT status FROM task_queue WHERE id = $1', [taskId]);
            expect(check.rows[0].status).toBe('cancelled');
        });

        test('should return 409 when cancelling a task in the wrong state', async () => {
            const taskId = await insertTask('failed');

            const response = await request(app)
                .post(`/api/queue/task/${taskId}/cancel`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(409);

            expect(response.body.code).toBe('invalid_state');
        });

        test('should return 400 for invalid task ids', async () => {
            const response = await request(app)
                .post('/api/queue/task/not-a-number/cancel')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(400);

            expect(response.body.code).toBe('invalid_task_id');
        });

        test('should return 401 without authentication', async () => {
            const taskId = await insertTask('pending');

            await request(app)
                .post(`/api/queue/task/${taskId}/cancel`)
                .expect(401);
        });
    });

    describe('POST /api/queue/clear-failed', () => {
        test('should delete all failed tasks and return the count', async () => {
            await insertTask('failed');
            await insertTask('failed');
            await insertTask('failed');
            const pendingId = await insertTask('pending');

            const response = await request(app)
                .post('/api/queue/clear-failed')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.count).toBe(3);

            const remaining = await db.query(`SELECT status FROM task_queue WHERE status = 'failed'`);
            expect(remaining.rows.length).toBe(0);

            const pendingCheck = await db.query('SELECT id FROM task_queue WHERE id = $1', [pendingId]);
            expect(pendingCheck.rows.length).toBe(1);
        });

        test('should return count 0 when no failed tasks exist', async () => {
            const response = await request(app)
                .post('/api/queue/clear-failed')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.count).toBe(0);
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .post('/api/queue/clear-failed')
                .expect(401);
        });
    });

    describe('POST /api/queue/retry-all-failed', () => {
        test('should retry all failed tasks and return count', async () => {
            await insertTask('failed');
            await insertTask('failed');
            const pendingId = await insertTask('pending');

            const response = await request(app)
                .post('/api/queue/retry-all-failed')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.count).toBe(2);

            const stillFailed = await db.query(`SELECT COUNT(*) FROM task_queue WHERE status = 'failed'`);
            expect(parseInt(stillFailed.rows[0].count)).toBe(0);

            const pendingCheck = await db.query(`SELECT status FROM task_queue WHERE id = $1`, [pendingId]);
            expect(pendingCheck.rows[0].status).toBe('pending');
        });

        test('should return count 0 when no failed tasks exist', async () => {
            const response = await request(app)
                .post('/api/queue/retry-all-failed')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.count).toBe(0);
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .post('/api/queue/retry-all-failed')
                .expect(401);
        });
    });

    describe('GET /api/queue/ollama-status', () => {
        test('should return Ollama generation status', async () => {
            const response = await request(app)
                .get('/api/queue/ollama-status')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('isGenerating');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/queue/ollama-status')
                .expect(401);
        });
    });
});
