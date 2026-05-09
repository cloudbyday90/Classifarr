/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import request from 'supertest';
import { jest } from '@jest/globals';
import { createStandardDbMock, createTestApp } from './helpers/setupRouteTest.mjs';

const query = jest.fn();

jest.unstable_mockModule('../config/database.mjs', () => createStandardDbMock(query));

jest.unstable_mockModule('../middleware/apiKeyAuth.mjs', () => ({
  authenticateTokenOrApiKey: (req, _res, next) => next(),
  requireReadWrite: (req, _res, next) => next(),
}));

const { router: notificationsRouter } = await import('../routes/notifications.mjs');

describe('notifications routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
    app.use('/api/notifications', notificationsRouter);
  });

  test('GET /api/notifications returns normalized rows with unread count and pagination', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 12,
            type: 'warning',
            title: 'Radarr connection lost',
            message: 'Unable to route classifications',
            data: JSON.stringify({ targetPath: '/', targetAnchor: 'alerts', dismissible: true }),
            is_read: false,
            created_at: '2026-02-12T00:00:00.000Z',
            read_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ unread: 1 }] });

    const response = await request(app)
      .get('/api/notifications?page=1&limit=10&filter=all')
      .expect(200);

    expect(response.body.unreadCount).toBe(1);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: 12,
      type: 'connection_lost',
      severity: 'warning',
      isRead: false,
      targetPath: '/',
      targetAnchor: 'alerts',
      dismissible: true,
    });
  });

  test('GET /api/notifications supports oldest sort order', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [{ unread: 0 }] });

    await request(app)
      .get('/api/notifications?sort=oldest')
      .expect(200);

    const listQuery = query.mock.calls[0][0];
    expect(listQuery).toContain('ORDER BY created_at ASC');
  });

  test('GET /api/notifications/unread-count returns unread total', async () => {
    query.mockResolvedValueOnce({ rows: [{ unread: 7 }] });

    const response = await request(app)
      .get('/api/notifications/unread-count')
      .expect(200);

    expect(response.body).toEqual({ unread: 7 });
  });

  test('GET /api/notifications/active returns unread rows only', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 81,
          type: 'error',
          title: 'Classification failed',
          message: 'The Matrix 5',
          data: '{}',
          is_read: false,
          created_at: '2026-02-12T00:00:00.000Z',
          read_at: null,
        },
      ],
    });

    const response = await request(app)
      .get('/api/notifications/active')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: 81,
      type: 'error',
      severity: 'error',
      isRead: false,
    });
  });

  test('POST /api/notifications/mark-all-read returns updated count', async () => {
    query.mockResolvedValueOnce({ rowCount: 4 });

    const response = await request(app)
      .post('/api/notifications/mark-all-read')
      .expect(200);

    expect(response.body).toEqual({ updated: 4 });
  });

  test('POST /api/notifications/clear-all clears all rows', async () => {
    query.mockResolvedValueOnce({ rowCount: 9 });

    const response = await request(app)
      .post('/api/notifications/clear-all')
      .expect(200);

    expect(response.body).toEqual({ cleared: 9 });
  });

  test('POST /api/notifications/:id/read validates id', async () => {
    const response = await request(app)
      .post('/api/notifications/not-a-number/read')
      .expect(400);

    expect(response.body.error).toBe('Invalid notification id');
  });

  test('POST /api/notifications/:id/read returns 404 when row is missing', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 });

    const response = await request(app)
      .post('/api/notifications/999/read')
      .expect(404);

    expect(response.body.error).toBe('Notification not found');
  });

  test('POST /api/notifications/:id/dismiss rejects non-dismissible rows', async () => {
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 100,
          type: 'info',
          title: 'Pinned notice',
          message: 'Cannot dismiss this entry',
          data: JSON.stringify({ dismissible: false }),
          is_read: true,
          created_at: '2026-02-12T00:00:00.000Z',
          read_at: '2026-02-12T00:05:00.000Z',
        },
      ],
    });

    const response = await request(app)
      .post('/api/notifications/100/dismiss')
      .expect(400);

    expect(response.body.error).toBe('Notification is not dismissible');
  });

  test('POST /api/notifications/:id/dismiss removes dismissible rows', async () => {
    query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 101,
            type: 'warning',
            title: 'Remap warning',
            message: 'Some library mappings need attention',
            data: '{}',
            is_read: false,
            created_at: '2026-02-12T00:00:00.000Z',
            read_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const response = await request(app)
      .post('/api/notifications/101/dismiss')
      .expect(200);

    expect(response.body).toEqual({ success: true, id: 101 });
    expect(query).toHaveBeenNthCalledWith(2, 'DELETE FROM app_notifications WHERE id = $1', [101]);
  });

  test('POST /api/notifications/:id/delete validates id', async () => {
    const response = await request(app)
      .post('/api/notifications/not-a-number/delete')
      .expect(400);

    expect(response.body.error).toBe('Invalid notification id');
  });

  test('POST /api/notifications/:id/delete returns 404 when row is missing', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const response = await request(app)
      .post('/api/notifications/999/delete')
      .expect(404);

    expect(response.body.error).toBe('Notification not found');
  });

  test('POST /api/notifications/:id/delete removes any row regardless of dismissible metadata', async () => {
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 777 }] });

    const response = await request(app)
      .post('/api/notifications/777/delete')
      .expect(200);

    expect(response.body).toEqual({ success: true, id: 777 });
    expect(query).toHaveBeenCalledWith(
      'DELETE FROM app_notifications WHERE id = $1 RETURNING id',
      [777]
    );
  });

  test('persists read-state across sequential API calls (session-to-session behavior)', async () => {
    const rows = [
      {
        id: 500,
        type: 'warning',
        title: '2 items awaiting decision',
        message: 'The Bear S03, Oppenheimer',
        data: JSON.stringify({ notificationType: 'awaiting_decision' }),
        is_read: false,
        created_at: '2026-02-12T00:00:00.000Z',
        read_at: null,
      },
    ];

    query.mockImplementation(async (sqlText, params = []) => {
      const sql = String(sqlText);

      if (sql.includes('SELECT COUNT(*)::int AS unread FROM app_notifications WHERE is_read = false')) {
        return { rows: [{ unread: rows.filter((row) => !row.is_read).length }] };
      }

      if (sql.includes('UPDATE app_notifications') && sql.includes('SET is_read = true') && sql.includes('WHERE id = $1')) {
        const id = Number(params[0]);
        const row = rows.find((item) => item.id === id);
        if (!row) return { rowCount: 0, rows: [] };
        row.is_read = true;
        row.read_at = '2026-02-12T00:01:00.000Z';
        return { rowCount: 1, rows: [{ id }] };
      }

      if (sql.includes('SELECT id, type, title, message, data, is_read, created_at, read_at') && sql.includes('LIMIT')) {
        return { rows: [...rows] };
      }

      if (sql.includes('SELECT COUNT(*)::int AS total FROM app_notifications')) {
        return { rows: [{ total: rows.length }] };
      }

      return { rows: [], rowCount: 0 };
    });

    const before = await request(app)
      .get('/api/notifications/unread-count')
      .expect(200);
    expect(before.body.unread).toBe(1);

    await request(app)
      .post('/api/notifications/500/read')
      .expect(200);

    const after = await request(app)
      .get('/api/notifications/unread-count')
      .expect(200);
    expect(after.body.unread).toBe(0);

    const feed = await request(app)
      .get('/api/notifications')
      .expect(200);
    expect(feed.body.data[0].isRead).toBe(true);
    expect(feed.body.data[0].type).toBe('awaiting_decision');
  });
});
