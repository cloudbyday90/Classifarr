/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * In-app notifications feed/read-state routes
 */

const express = require('express');
const db = require('../config/database');
const { authenticateTokenOrApiKey, requireReadWrite } = require('../middleware/apiKeyAuth');

const router = express.Router();

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

router.use(authenticateTokenOrApiKey);

function safeJsonObject(value) {
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

function inferType(row, data) {
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

function getSeverity(row) {
  if (row.type === 'error' || row.type === 'warning' || row.type === 'success' || row.type === 'info') {
    return row.type;
  }
  return 'info';
}

function defaultTarget(type) {
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

function normalizeNotification(row) {
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

function buildSqlFilter({ filter, search }) {
  const conditions = [];
  const params = [];
  let index = 1;

  if (filter === 'unread') {
    conditions.push(`is_read = false`);
  } else if (filter === 'alerts') {
    conditions.push(`type IN ('warning', 'error')`);
  } else if (filter === 'info') {
    conditions.push(`type IN ('info', 'success')`);
  } else if (filter === 'read') {
    conditions.push(`is_read = true`);
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

function buildOrderClause(sort) {
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

router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
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

    res.json({
      data: normalizedRows,
      unreadCount: Number(unreadResult.rows[0]?.unread || 0),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/unread-count', async (_req, res) => {
  try {
    const result = await db.query(
      'SELECT COUNT(*)::int AS unread FROM app_notifications WHERE is_read = false'
    );
    res.json({ unread: Number(result.rows[0]?.unread || 0) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/active', async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT id, type, title, message, data, is_read, created_at, read_at
      FROM app_notifications
      WHERE is_read = false
      ORDER BY created_at DESC
      LIMIT 20
    `);
    res.json(result.rows.map(normalizeNotification));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mark-all-read', requireReadWrite, async (_req, res) => {
  try {
    const result = await db.query(`
      UPDATE app_notifications
      SET is_read = true, read_at = NOW()
      WHERE is_read = false
      RETURNING id
    `);
    res.json({ updated: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/clear-read', requireReadWrite, async (_req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM app_notifications
      WHERE is_read = true
      RETURNING id
    `);
    res.json({ cleared: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/read', requireReadWrite, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notification id' });

    const result = await db.query(`
      UPDATE app_notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/unread', requireReadWrite, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notification id' });

    const result = await db.query(`
      UPDATE app_notifications
      SET is_read = false, read_at = NULL
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/dismiss', requireReadWrite, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid notification id' });

    const existing = await db.query(`
      SELECT id, type, title, message, data, is_read, created_at, read_at
      FROM app_notifications
      WHERE id = $1
      LIMIT 1
    `, [id]);

    if (existing.rowCount === 0) return res.status(404).json({ error: 'Notification not found' });

    const normalized = normalizeNotification(existing.rows[0]);
    if (!normalized.dismissible) {
      return res.status(400).json({ error: 'Notification is not dismissible' });
    }

    await db.query('DELETE FROM app_notifications WHERE id = $1', [id]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
