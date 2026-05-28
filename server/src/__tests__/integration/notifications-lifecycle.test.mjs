import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateTokenOrApiKey, requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');
const { createNotificationsRouter } = await import('../../routes/notificationsRouteShared.mjs');

const express = (await import('express')).default;

const app = createIntegrationTestApp({
    basePath: '/api/notifications',
    router: createNotificationsRouter({
        express,
        db,
        authenticateTokenOrApiKey,
        requireReadWrite,
    }),
});

describe('Notifications Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('notif_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'notif_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM app_notifications');
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function seedNotification(type, title, message, data = {}, isRead = false) {
        const result = await db.query(`
            INSERT INTO app_notifications (type, title, message, data, is_read, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, type, title, message, data, is_read, created_at, read_at
        `, [type, title, message, JSON.stringify(data), isRead]);
        return result.rows[0];
    }

    describe('GET / — list notifications', () => {
        it('returns paginated notifications with unread count', async () => {
            await seedNotification('warning', 'Test Warning', 'Something happened');
            await seedNotification('info', 'Test Info', 'All good', {}, true);
            await seedNotification('error', 'Test Error', 'Something broke');

            const res = await request(app)
                .get('/api/notifications?page=1&limit=10')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(3);
            expect(res.body.unreadCount).toBe(2);
            expect(res.body.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 3,
                totalPages: 1,
            });
        });

        it('filters to unread only', async () => {
            await seedNotification('info', 'Unread', 'Not read');
            await seedNotification('info', 'Read', 'Was read', {}, true);

            const res = await request(app)
                .get('/api/notifications?filter=unread')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].title).toBe('Unread');
        });

        it('filters to alerts (error + warning)', async () => {
            await seedNotification('warning', 'Warning', 'Alert');
            await seedNotification('error', 'Error', 'Alert');
            await seedNotification('info', 'Info', 'Not alert');

            const res = await request(app)
                .get('/api/notifications?filter=alerts')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('sorts oldest first', async () => {
            await seedNotification('info', 'First', 'Created first');
            await seedNotification('info', 'Second', 'Created second');

            const res = await request(app)
                .get('/api/notifications?sort=oldest')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.data[0].title).toBe('First');
            expect(res.body.data[1].title).toBe('Second');
        });

        it('paginates correctly with limit', async () => {
            for (let i = 0; i < 5; i++) {
                await seedNotification('info', `Notif ${i}`, `Message ${i}`);
            }

            const res = await request(app)
                .get('/api/notifications?page=1&limit=2')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.pagination).toMatchObject({
                page: 1,
                limit: 2,
                total: 5,
                totalPages: 3,
            });
        });

        it('searches by title and message', async () => {
            await seedNotification('info', 'Radarr Sync', 'Completed successfully');
            await seedNotification('info', 'Plex Auth', 'Token refreshed');

            const res = await request(app)
                .get('/api/notifications?search=radarr')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].title).toBe('Radarr Sync');
        });

        it('requires authentication', async () => {
            const res = await request(app)
                .get('/api/notifications');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /unread-count', () => {
        it('returns zero when no notifications exist', async () => {
            const res = await request(app)
                .get('/api/notifications/unread-count')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.unread).toBe(0);
        });

        it('counts only unread notifications', async () => {
            await seedNotification('info', 'Unread 1', 'Msg');
            await seedNotification('info', 'Unread 2', 'Msg');
            await seedNotification('info', 'Read', 'Msg', {}, true);

            const res = await request(app)
                .get('/api/notifications/unread-count')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.unread).toBe(2);
        });
    });

    describe('GET /active', () => {
        it('returns only unread notifications limited to 20', async () => {
            await seedNotification('warning', 'Active', 'Unread notification');
            await seedNotification('info', 'Inactive', 'Read notification', {}, true);

            const res = await request(app)
                .get('/api/notifications/active')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].title).toBe('Active');
            expect(res.body[0].isRead).toBe(false);
        });

        it('normalizes notification type from data.notificationType', async () => {
            await seedNotification('info', 'Needs Attention', 'Action required', {
                notificationType: 'awaiting_decision',
            });

            const res = await request(app)
                .get('/api/notifications/active')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body[0].type).toBe('awaiting_decision');
            expect(res.body[0].targetPath).toBe('/');
            expect(res.body[0].targetAnchor).toBe('needs-attention');
        });
    });

    describe('POST /mark-all-read', () => {
        it('marks all unread notifications as read', async () => {
            await seedNotification('info', 'Unread 1', 'Msg');
            await seedNotification('info', 'Unread 2', 'Msg');
            await seedNotification('info', 'Already Read', 'Msg', {}, true);

            const res = await request(app)
                .post('/api/notifications/mark-all-read')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.updated).toBe(2);

            const unread = await db.query('SELECT COUNT(*)::int AS count FROM app_notifications WHERE is_read = false');
            expect(unread.rows[0].count).toBe(0);

            const readAtResult = await db.query('SELECT read_at FROM app_notifications WHERE title = $1', ['Unread 1']);
            expect(readAtResult.rows[0].read_at).not.toBeNull();
        });

        it('returns zero when all are already read', async () => {
            await seedNotification('info', 'Read', 'Msg', {}, true);

            const res = await request(app)
                .post('/api/notifications/mark-all-read')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.updated).toBe(0);
        });
    });

    describe('POST /clear-read', () => {
        it('deletes only read notifications', async () => {
            await seedNotification('info', 'Unread', 'Stays');
            await seedNotification('info', 'Read', 'Gets deleted', {}, true);

            const res = await request(app)
                .post('/api/notifications/clear-read')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.cleared).toBe(1);

            const remaining = await db.query('SELECT title FROM app_notifications ORDER BY title');
            expect(remaining.rows).toHaveLength(1);
            expect(remaining.rows[0].title).toBe('Unread');
        });
    });

    describe('POST /clear-all', () => {
        it('deletes all notifications regardless of read state', async () => {
            await seedNotification('info', 'Unread', 'Stays');
            await seedNotification('info', 'Read', 'Gets deleted', {}, true);

            const res = await request(app)
                .post('/api/notifications/clear-all')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.cleared).toBe(2);

            const remaining = await db.query('SELECT COUNT(*)::int AS count FROM app_notifications');
            expect(remaining.rows[0].count).toBe(0);
        });
    });

    describe('POST /:id/read', () => {
        it('marks a single notification as read', async () => {
            const notif = await seedNotification('warning', 'Test', 'Unread');

            const res = await request(app)
                .post(`/api/notifications/${notif.id}/read`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ success: true, id: notif.id });

            const row = await db.query('SELECT is_read, read_at FROM app_notifications WHERE id = $1', [notif.id]);
            expect(row.rows[0].is_read).toBe(true);
            expect(row.rows[0].read_at).not.toBeNull();
        });

        it('returns 404 for non-existent notification', async () => {
            const res = await request(app)
                .post('/api/notifications/999999/read')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid id', async () => {
            const res = await request(app)
                .post('/api/notifications/not-a-number/read')
                .set(authHeaders());

            expect(res.status).toBe(400);
        });
    });

    describe('POST /:id/unread', () => {
        it('marks a read notification as unread', async () => {
            const notif = await seedNotification('info', 'Test', 'Read', {}, true);

            const res = await request(app)
                .post(`/api/notifications/${notif.id}/unread`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ success: true, id: notif.id });

            const row = await db.query('SELECT is_read, read_at FROM app_notifications WHERE id = $1', [notif.id]);
            expect(row.rows[0].is_read).toBe(false);
            expect(row.rows[0].read_at).toBeNull();
        });

        it('returns 404 for non-existent notification', async () => {
            const res = await request(app)
                .post('/api/notifications/999999/unread')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });
    });

    describe('POST /:id/dismiss', () => {
        it('deletes a dismissible notification', async () => {
            const notif = await seedNotification('warning', 'Dismissible', 'Can be dismissed');

            const res = await request(app)
                .post(`/api/notifications/${notif.id}/dismiss`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ success: true, id: notif.id });

            const row = await db.query('SELECT COUNT(*)::int AS count FROM app_notifications WHERE id = $1', [notif.id]);
            expect(row.rows[0].count).toBe(0);
        });

        it('rejects non-dismissible notification with 400', async () => {
            const notif = await seedNotification('info', 'Pinned', 'Cannot dismiss', { dismissible: false });

            const res = await request(app)
                .post(`/api/notifications/${notif.id}/dismiss`)
                .set(authHeaders());

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Notification is not dismissible');

            const row = await db.query('SELECT COUNT(*)::int AS count FROM app_notifications WHERE id = $1', [notif.id]);
            expect(row.rows[0].count).toBe(1);
        });

        it('returns 404 for non-existent notification', async () => {
            const res = await request(app)
                .post('/api/notifications/999999/dismiss')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });
    });

    describe('POST /:id/delete', () => {
        it('deletes any notification regardless of dismissible flag', async () => {
            const notif = await seedNotification('info', 'Protected', 'Not dismissible', { dismissible: false });

            const res = await request(app)
                .post(`/api/notifications/${notif.id}/delete`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ success: true, id: notif.id });

            const row = await db.query('SELECT COUNT(*)::int AS count FROM app_notifications WHERE id = $1', [notif.id]);
            expect(row.rows[0].count).toBe(0);
        });

        it('returns 404 for non-existent notification', async () => {
            const res = await request(app)
                .post('/api/notifications/999999/delete')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid id', async () => {
            const res = await request(app)
                .post('/api/notifications/invalid/delete')
                .set(authHeaders());

            expect(res.status).toBe(400);
        });
    });

    describe('Full notification lifecycle', () => {
        it('seed → list → read → unread → dismiss → clear-all', async () => {
            const n1 = await seedNotification('warning', 'Lifecycle 1', 'First');
            const n2 = await seedNotification('info', 'Lifecycle 2', 'Second');

            const list = await request(app)
                .get('/api/notifications')
                .set(authHeaders());
            expect(list.body.data).toHaveLength(2);
            expect(list.body.unreadCount).toBe(2);

            await request(app)
                .post(`/api/notifications/${n1.id}/read`)
                .set(authHeaders())
                .expect(200);

            const afterRead = await request(app)
                .get('/api/notifications/unread-count')
                .set(authHeaders());
            expect(afterRead.body.unread).toBe(1);

            await request(app)
                .post(`/api/notifications/${n1.id}/unread`)
                .set(authHeaders())
                .expect(200);

            const afterUnread = await request(app)
                .get('/api/notifications/unread-count')
                .set(authHeaders());
            expect(afterUnread.body.unread).toBe(2);

            await request(app)
                .post(`/api/notifications/${n2.id}/dismiss`)
                .set(authHeaders())
                .expect(200);

            const afterDismiss = await request(app)
                .get('/api/notifications')
                .set(authHeaders());
            expect(afterDismiss.body.data).toHaveLength(1);
            expect(afterDismiss.body.data[0].title).toBe('Lifecycle 1');

            await request(app)
                .post('/api/notifications/clear-all')
                .set(authHeaders())
                .expect(200);

            const afterClear = await request(app)
                .get('/api/notifications')
                .set(authHeaders());
            expect(afterClear.body.data).toHaveLength(0);
            expect(afterClear.body.unreadCount).toBe(0);
        });
    });

    describe('Notification type inference', () => {
        it('infers connection_lost from title text', async () => {
            await seedNotification('warning', 'Radarr connection lost', 'Unable to connect');

            const res = await request(app)
                .get('/api/notifications')
                .set(authHeaders());

            expect(res.body.data[0].type).toBe('connection_lost');
        });

        it('infers budget_warning from message text', async () => {
            await seedNotification('warning', 'Budget alert', 'Budget threshold exceeded');

            const res = await request(app)
                .get('/api/notifications')
                .set(authHeaders());

            expect(res.body.data[0].type).toBe('budget_warning');
        });

        it('uses explicit notificationType from data over text inference', async () => {
            await seedNotification('info', 'Generic title', 'Generic message', {
                notificationType: 'sync_completed',
            });

            const res = await request(app)
                .get('/api/notifications')
                .set(authHeaders());

            expect(res.body.data[0].type).toBe('sync_completed');
        });
    });

    describe('Mark-all-read + clear-read workflow', () => {
        it('mark-all-read then clear-read leaves only unread', async () => {
            await seedNotification('info', 'To Read', 'Will be marked read');
            await seedNotification('info', 'Stays Unread', 'Will remain');

            await request(app)
                .post('/api/notifications/mark-all-read')
                .set(authHeaders())
                .expect(200);

            const afterMark = await request(app)
                .get('/api/notifications/unread-count')
                .set(authHeaders());
            expect(afterMark.body.unread).toBe(0);

            await seedNotification('error', 'New Error', 'Fresh notification');

            await request(app)
                .post('/api/notifications/clear-read')
                .set(authHeaders())
                .expect(200);

            const remaining = await db.query('SELECT title FROM app_notifications ORDER BY title');
            expect(remaining.rows).toHaveLength(1);
            expect(remaining.rows[0].title).toBe('New Error');
        });
    });
});
