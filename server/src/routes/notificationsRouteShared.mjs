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

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

const NOTIFICATION_TYPES = new Set([
  'awaiting_decision',
  'error',
  'connection_lost',
  'connection_restored',
  'budget_warning',
  'sync_completed',
  'enrichment_completed',
  'policy_suggestion',
  'update_available',
]);

export function safeJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export function inferType(row, data) {
  const explicit = data.notificationType || data.type || null;
  if (explicit && NOTIFICATION_TYPES.has(explicit)) return explicit;

  const title = String(row.title || '').toLowerCase();
  const message = String(row.message || '').toLowerCase();
  const text = `${title} ${message}`;

  if (text.includes('awaiting decision') || text.includes('needs attention') || text.includes('policy question')) return 'awaiting_decision';
  if (text.includes('connection lost') || text.includes('unable to route') || text.includes('disconnected')) return 'connection_lost';
  if (text.includes('connection restored') || text.includes('reconnected')) return 'connection_restored';
  if (text.includes('budget') || text.includes('spend')) return 'budget_warning';
  if (text.includes('enrichment')) return 'enrichment_completed';
  if (text.includes('sync completed') || text.includes('sync finished')) return 'sync_completed';
  if (text.includes('suggestion')) return 'policy_suggestion';
  if (text.includes('update available') || text.includes('new version')) return 'update_available';
  if (row.type === 'error') return 'error';
  if (row.type === 'success') return 'sync_completed';
  if (row.type === 'warning') return 'policy_suggestion';
  return 'update_available';
}

export function getSeverity(row) {
  if (row.type === 'error' || row.type === 'warning' || row.type === 'success' || row.type === 'info') {
    return row.type;
  }
  return 'info';
}

export function defaultTarget(type) {
  switch (type) {
    case 'awaiting_decision':
      return { targetPath: '/', targetAnchor: 'needs-attention' };
    case 'error':
      return { targetPath: '/', targetAnchor: 'errors' };
    case 'connection_lost':
    case 'connection_restored':
    case 'budget_warning':
      return { targetPath: '/', targetAnchor: 'alerts' };
    case 'sync_completed':
      return { targetPath: '/', targetAnchor: 'libraries' };
    case 'enrichment_completed':
      return { targetPath: '/', targetAnchor: 'enrichment' };
    case 'policy_suggestion':
      return { targetPath: '/tuning-suggestions', targetAnchor: null };
    case 'update_available':
      return { targetPath: '/system', targetAnchor: null };
    default:
      return { targetPath: '/', targetAnchor: null };
  }
}

export function normalizeNotification(row) {
  const data = safeJsonObject(row.data);
  const type = inferType(row, data);
  const defaults = defaultTarget(type);
  const targetPath = data.targetPath || data.target_path || defaults.targetPath;
  const targetAnchor = data.targetAnchor || data.target_anchor || defaults.targetAnchor;

  return {
    id: row.id,
    type,
    title: row.title,
    message: row.message,
    severity: getSeverity(row),
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at,
    targetPath,
    targetAnchor,
    actionMeta: data.actionMeta || data.action_meta || null,
    dismissible: data.dismissible !== false,
  };
}

export function buildSqlFilter({ filter, search }) {
  const conditions = [];
  const params = [];
  let index = 1;

  if (filter === 'unread') {
    conditions.push('is_read = false');
  } else if (filter === 'alerts') {
    conditions.push("type IN ('warning', 'error')");
  } else if (filter === 'info') {
    conditions.push("type IN ('info', 'success')");
  } else if (filter === 'read') {
    conditions.push('is_read = true');
  }

  if (search && search.trim().length > 0) {
    conditions.push(`(title ILIKE $${index} OR message ILIKE $${index})`);
    params.push(`%${search.trim()}%`);
    index += 1;
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

export function buildOrderClause(sort) {
  switch (String(sort || 'newest').toLowerCase()) {
    case 'oldest':
      return 'created_at ASC';
    case 'unread_first':
      return 'is_read ASC, created_at DESC';
    case 'newest':
    default:
      return 'created_at DESC';
  }
}

export function createNotificationsRouter({
  express,
  db,
  authenticateTokenOrApiKey,
  requireReadWrite,
}) {
  const router = express.Router();

  router.use(authenticateTokenOrApiKey);

  router.get('/', asyncHandler(async (req, res) => {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;
    const filter = String(req.query.filter || 'all').toLowerCase();
    const sort = String(req.query.sort || 'newest').toLowerCase();
    const search = req.query.search;

    const sqlFilter = buildSqlFilter({ filter, search });
    const orderClause = buildOrderClause(sort);

    const listQuery = `
      SELECT id, type, title, message, data, is_read, created_at, read_at
      FROM app_notifications
      ${sqlFilter.whereClause}
      ORDER BY ${orderClause}
      LIMIT $${sqlFilter.nextIndex} OFFSET $${sqlFilter.nextIndex + 1}
    `;

    const listParams = [...sqlFilter.params, limit, offset];
    const [listResult, countResult, unreadResult] = await Promise.all([
      db.query(listQuery, listParams),
      db.query(
        `SELECT COUNT(*)::int AS total FROM app_notifications ${sqlFilter.whereClause}`,
        sqlFilter.params
      ),
      db.query('SELECT COUNT(*)::int AS unread FROM app_notifications WHERE is_read = false'),
    ]);

    const normalizedRows = listResult.rows.map(normalizeNotification);
    const total = Number(countResult.rows[0]?.total || 0);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

    return sendData(res, {
      data: normalizedRows,
      unreadCount: Number(unreadResult.rows[0]?.unread || 0),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  }));

  router.get('/unread-count', asyncHandler(async (_req, res) => {
    const result = await db.query(
      'SELECT COUNT(*)::int AS unread FROM app_notifications WHERE is_read = false'
    );
    return sendData(res, { unread: Number(result.rows[0]?.unread || 0) });
  }));

  router.get('/active', asyncHandler(async (_req, res) => {
    const result = await db.query(`
      SELECT id, type, title, message, data, is_read, created_at, read_at
      FROM app_notifications
      WHERE is_read = false
      ORDER BY created_at DESC
      LIMIT 20
    `);
    return sendData(res, result.rows.map(normalizeNotification));
  }));

  router.post('/mark-all-read', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await db.query(`
      UPDATE app_notifications
      SET is_read = true, read_at = NOW()
      WHERE is_read = false
      RETURNING id
    `);
    return sendData(res, { updated: result.rowCount });
  }));

  router.post('/clear-read', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await db.query(`
      DELETE FROM app_notifications
      WHERE is_read = true
      RETURNING id
    `);
    return sendData(res, { cleared: result.rowCount });
  }));

  router.post('/clear-all', requireReadWrite, asyncHandler(async (_req, res) => {
    const result = await db.query(`
      DELETE FROM app_notifications
      RETURNING id
    `);
    return sendData(res, { cleared: result.rowCount });
  }));

  router.post('/:id/read', requireReadWrite, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return sendError(res, 'Invalid notification id');
    }

    const result = await db.query(
      `
        UPDATE app_notifications
        SET is_read = true, read_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return sendError(res, 'Notification not found', 404);
    }
    return sendSuccess(res, { id });
  }));

  router.post('/:id/unread', requireReadWrite, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return sendError(res, 'Invalid notification id');
    }

    const result = await db.query(
      `
        UPDATE app_notifications
        SET is_read = false, read_at = NULL
        WHERE id = $1
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return sendError(res, 'Notification not found', 404);
    }
    return sendSuccess(res, { id });
  }));

  router.post('/:id/dismiss', requireReadWrite, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return sendError(res, 'Invalid notification id');
    }

    const existing = await db.query(
      `
        SELECT id, type, title, message, data, is_read, created_at, read_at
        FROM app_notifications
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );

    if (existing.rowCount === 0) {
      return sendError(res, 'Notification not found', 404);
    }

    const normalized = normalizeNotification(existing.rows[0]);
    if (!normalized.dismissible) {
      return sendError(res, 'Notification is not dismissible');
    }

    await db.query('DELETE FROM app_notifications WHERE id = $1', [id]);
    return sendSuccess(res, { id });
  }));

  router.post('/:id/delete', requireReadWrite, asyncHandler(async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return sendError(res, 'Invalid notification id');
    }

    const result = await db.query('DELETE FROM app_notifications WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return sendError(res, 'Notification not found', 404);
    }

    return sendSuccess(res, { id });
  }));

  return router;
}
