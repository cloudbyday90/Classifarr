import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
const { createReclassificationRouter } = await import('../../routes/reclassificationRouteShared.mjs');
const { reclassificationBatchService } = await import('../../services/reclassificationBatchService.mjs');

const express = (await import('express')).default;

const app = createIntegrationTestApp({
    basePath: '/api/reclassification',
    middleware: [authenticateToken, requireAdmin],
    router: createReclassificationRouter({ express, reclassificationBatchService }),
});

describe('Reclassification Batch Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;
    let libraryA;
    let libraryB;

    beforeAll(async () => {
        await reclassificationBatchService.ensureTables();

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('reclass_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'reclass_test_user',
            role: 'admin',
        });

        libraryA = await seedLibrary('Movies', 'movie');
        libraryB = await seedLibrary('TV Shows', 'tv');
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM classification_history WHERE title LIKE \'ReclassTest%\'');
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await db.query('DELETE FROM libraries WHERE id = ANY($1)', [[libraryA.id, libraryB.id]]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM reclassification_batch_items');
        await db.query('DELETE FROM reclassification_batches');
        await db.query('DELETE FROM classification_history WHERE title LIKE \'ReclassTest%\'');
    });

    async function seedLibrary(name, mediaType) {
        const result = await db.query(`
            INSERT INTO libraries (name, external_id, media_type, is_active)
            VALUES ($1, $1, $2, true)
            RETURNING id, name
        `, [name, mediaType]);
        return result.rows[0];
    }

    async function seedClassification(title, libraryId, mediaType = 'movie') {
        const result = await db.query(`
            INSERT INTO classification_history (title, media_type, library_id, method, status, confidence)
            VALUES ($1, $2, $3, 'ai_analysis', 'completed', 85)
            RETURNING id
        `, [title, mediaType, libraryId]);
        return result.rows[0].id;
    }

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    describe('POST /batch — create batch', () => {
        it('creates a batch with valid items', async () => {
            const c1 = await seedClassification('ReclassTest Movie 1', libraryA.id);
            const c2 = await seedClassification('ReclassTest Movie 2', libraryA.id);

            const res = await request(app)
                .post('/api/reclassification/batch')
                .set(authHeaders())
                .send({
                    items: [
                        { classificationId: c1, targetLibraryId: libraryB.id },
                        { classificationId: c2, targetLibraryId: libraryB.id },
                    ],
                    pauseOnError: true,
                });

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({
                status: 'pending',
                total_items: 2,
                completed_items: 0,
                failed_items: 0,
                skipped_items: 0,
                pause_on_error: true,
            });

            const batchRow = await db.query('SELECT * FROM reclassification_batches WHERE id = $1', [res.body.id]);
            expect(batchRow.rows[0].status).toBe('pending');

            const items = await db.query('SELECT * FROM reclassification_batch_items WHERE batch_id = $1 ORDER BY execution_order', [res.body.id]);
            expect(items.rows).toHaveLength(2);
            expect(items.rows[0].classification_id).toBe(c1);
            expect(items.rows[0].execution_order).toBe(1);
            expect(items.rows[1].classification_id).toBe(c2);
            expect(items.rows[1].execution_order).toBe(2);
        });

        it('rejects empty items array with 400', async () => {
            const res = await request(app)
                .post('/api/reclassification/batch')
                .set(authHeaders())
                .send({ items: [] });

            expect(res.status).toBe(400);
        });

        it('rejects missing items with 400', async () => {
            const res = await request(app)
                .post('/api/reclassification/batch')
                .set(authHeaders())
                .send({});

            expect(res.status).toBe(400);
        });

        it('requires authentication', async () => {
            const res = await request(app)
                .post('/api/reclassification/batch')
                .send({ items: [{ classificationId: 1, targetLibraryId: 2 }] });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /batch/:id — batch status', () => {
        it('returns full batch status with items', async () => {
            const c1 = await seedClassification('ReclassTest Status Movie', libraryA.id);
            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
            ]);

            const res = await request(app)
                .get(`/api/reclassification/batch/${batch.id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                id: batch.id,
                status: 'pending',
                total_items: 1,
            });
            expect(res.body.items).toHaveLength(1);
        });

        it('returns 404 for non-existent batch', async () => {
            const res = await request(app)
                .get('/api/reclassification/batch/999999')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });
    });

    describe('GET /batch/:id/progress — lightweight polling', () => {
        it('returns progress summary', async () => {
            const c1 = await seedClassification('ReclassTest Progress Movie', libraryA.id);
            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
            ]);

            const res = await request(app)
                .get(`/api/reclassification/batch/${batch.id}/progress`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                batchId: batch.id,
                status: 'pending',
            });
            expect(res.body.progress).toMatchObject({
                total: 1,
                completed: 0,
                failed: 0,
                skipped: 0,
                remaining: 1,
                percentage: 0,
            });
        });
    });

    describe('GET /batches — list batches', () => {
        it('lists recent batches ordered by creation date', async () => {
            const c1 = await seedClassification('ReclassTest List 1', libraryA.id);
            const c2 = await seedClassification('ReclassTest List 2', libraryA.id);

            await reclassificationBatchService.createBatch([{ classificationId: c1, targetLibraryId: libraryB.id }]);
            await reclassificationBatchService.createBatch([{ classificationId: c2, targetLibraryId: libraryB.id }]);

            const res = await request(app)
                .get('/api/reclassification/batches')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].id).toBeGreaterThan(res.body[1].id);
        });

        it('respects limit parameter', async () => {
            const c1 = await seedClassification('ReclassTest Limit 1', libraryA.id);
            const c2 = await seedClassification('ReclassTest Limit 2', libraryA.id);

            await reclassificationBatchService.createBatch([{ classificationId: c1, targetLibraryId: libraryB.id }]);
            await reclassificationBatchService.createBatch([{ classificationId: c2, targetLibraryId: libraryB.id }]);

            const res = await request(app)
                .get('/api/reclassification/batches?limit=1')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
    });

    describe('POST /batch/:id/cancel — cancel batch', () => {
        it('cancels a pending batch and marks pending items as cancelled', async () => {
            const c1 = await seedClassification('ReclassTest Cancel 1', libraryA.id);
            const c2 = await seedClassification('ReclassTest Cancel 2', libraryA.id);

            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
                { classificationId: c2, targetLibraryId: libraryB.id },
            ]);

            const res = await request(app)
                .post(`/api/reclassification/batch/${batch.id}/cancel`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('cancelled');

            const items = await db.query('SELECT status FROM reclassification_batch_items WHERE batch_id = $1 ORDER BY execution_order', [batch.id]);
            expect(items.rows.every(r => r.status === 'cancelled')).toBe(true);
        });
    });

    describe('POST /batch/:id/item/:itemId/skip — skip item', () => {
        it('marks a failed item as skipped and increments counter', async () => {
            const c1 = await seedClassification('ReclassTest Skip 1', libraryA.id);
            const c2 = await seedClassification('ReclassTest Skip 2', libraryA.id);

            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
                { classificationId: c2, targetLibraryId: libraryB.id },
            ], { pauseOnError: false });

            const items = await db.query('SELECT id FROM reclassification_batch_items WHERE batch_id = $1 ORDER BY execution_order', [batch.id]);

            await db.query("UPDATE reclassification_batch_items SET status = 'failed' WHERE id = $1", [items.rows[0].id]);
            await db.query("UPDATE reclassification_batches SET failed_items = 1 WHERE id = $1", [batch.id]);

            const res = await request(app)
                .post(`/api/reclassification/batch/${batch.id}/item/${items.rows[0].id}/skip`)
                .set(authHeaders());

            expect(res.status).toBe(200);

            const skippedItem = await db.query('SELECT status FROM reclassification_batch_items WHERE id = $1', [items.rows[0].id]);
            expect(skippedItem.rows[0].status).toBe('skipped');

            const batchRow = await db.query('SELECT skipped_items FROM reclassification_batches WHERE id = $1', [batch.id]);
            expect(batchRow.rows[0].skipped_items).toBe(1);
        });
    });

    describe('POST /batch/:id/item/:itemId/retry — retry item', () => {
        it('resets a failed item to validated status', async () => {
            const c1 = await seedClassification('ReclassTest Retry', libraryA.id);
            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
            ]);

            const items = await db.query('SELECT id FROM reclassification_batch_items WHERE batch_id = $1', [batch.id]);

            await db.query("UPDATE reclassification_batch_items SET status = 'failed', error_message = 'some error' WHERE id = $1", [items.rows[0].id]);

            const res = await request(app)
                .post(`/api/reclassification/batch/${batch.id}/item/${items.rows[0].id}/retry`)
                .set(authHeaders());

            expect(res.status).toBe(200);

            const retriedItem = await db.query('SELECT status, error_message FROM reclassification_batch_items WHERE id = $1', [items.rows[0].id]);
            expect(retriedItem.rows[0].status).toBe('validated');
            expect(retriedItem.rows[0].error_message).toBeNull();
        });
    });

    describe('POST /batch/:id/pause — pause batch', () => {
        it('pauses an executing batch', async () => {
            const c1 = await seedClassification('ReclassTest Pause', libraryA.id);
            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
            ]);

            await db.query("UPDATE reclassification_batches SET status = 'executing' WHERE id = $1", [batch.id]);

            const res = await request(app)
                .post(`/api/reclassification/batch/${batch.id}/pause`)
                .set(authHeaders());

            expect(res.status).toBe(200);

            const batchRow = await db.query('SELECT status FROM reclassification_batches WHERE id = $1', [batch.id]);
            expect(batchRow.rows[0].status).toBe('paused');
        });

        it('does not pause a batch that is not executing', async () => {
            const c1 = await seedClassification('ReclassTest NoPause', libraryA.id);
            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
            ]);

            const res = await request(app)
                .post(`/api/reclassification/batch/${batch.id}/pause`)
                .set(authHeaders());

            expect(res.status).toBe(200);

            const batchRow = await db.query('SELECT status FROM reclassification_batches WHERE id = $1', [batch.id]);
            expect(batchRow.rows[0].status).toBe('pending');
        });
    });

    describe('DB constraint verification', () => {
        it('FK cascade deletes items when batch is deleted', async () => {
            const c1 = await seedClassification('ReclassTest Cascade', libraryA.id);
            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
            ]);

            const itemsBefore = await db.query('SELECT count(*) FROM reclassification_batch_items WHERE batch_id = $1', [batch.id]);
            expect(parseInt(itemsBefore.rows[0].count)).toBe(1);

            await db.query('DELETE FROM reclassification_batches WHERE id = $1', [batch.id]);

            const itemsAfter = await db.query('SELECT count(*) FROM reclassification_batch_items WHERE batch_id = $1', [batch.id]);
            expect(parseInt(itemsAfter.rows[0].count)).toBe(0);
        });

        it('preserves batch table across concurrent createBatch calls', async () => {
            const c1 = await seedClassification('ReclassTest Concurrent 1', libraryA.id);
            const c2 = await seedClassification('ReclassTest Concurrent 2', libraryA.id);

            const [batch1, batch2] = await Promise.all([
                reclassificationBatchService.createBatch([{ classificationId: c1, targetLibraryId: libraryB.id }]),
                reclassificationBatchService.createBatch([{ classificationId: c2, targetLibraryId: libraryB.id }]),
            ]);

            expect(batch1.id).toBeDefined();
            expect(batch2.id).toBeDefined();
            expect(batch1.id).not.toBe(batch2.id);

            const batches = await db.query('SELECT id FROM reclassification_batches WHERE id = ANY($1) ORDER BY id', [[batch1.id, batch2.id]]);
            expect(batches.rows).toHaveLength(2);
        });
    });

    describe('Progress computation accuracy', () => {
        it('calculates percentage correctly after partial progress', async () => {
            const c1 = await seedClassification('ReclassTest Pct 1', libraryA.id);
            const c2 = await seedClassification('ReclassTest Pct 2', libraryA.id);
            const c3 = await seedClassification('ReclassTest Pct 3', libraryA.id);

            const batch = await reclassificationBatchService.createBatch([
                { classificationId: c1, targetLibraryId: libraryB.id },
                { classificationId: c2, targetLibraryId: libraryB.id },
                { classificationId: c3, targetLibraryId: libraryB.id },
            ]);

            await db.query("UPDATE reclassification_batches SET completed_items = 2 WHERE id = $1", [batch.id]);

            const progress = await reclassificationBatchService.getBatchProgress(batch.id);
            expect(progress.progress.percentage).toBe(67);
            expect(progress.progress.remaining).toBe(1);
        });
    });
});
