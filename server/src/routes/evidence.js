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

/**
 * routes/evidence.js
 *
 * Phase 6 — Layer 4 admin surface for the classification_evidence table.
 *
 * All routes require authentication + admin. Auth is applied at the api.js
 * mount point (router.use('/evidence', authenticateToken, requireAdmin, evidenceRouter)).
 *
 * Endpoints
 * ---------
 *   GET  /evidence/summary       — aggregate counts by scope/provenance/status
 *   GET  /evidence               — paginated, filtered list
 *   GET  /evidence/:id           — single row by PK
 *   GET  /evidence/:id/diagnose  — operator diagnostic view for one row
 *   POST /evidence/:id/decay     — set status=candidate
 *   POST /evidence/:id/promote   — set status=active
 *   POST /evidence/purge         — bulk purge (at least one filter required)
 */

'use strict';

const express = require('express');
const classificationEvidenceRepository = require('../services/classificationEvidenceRepository');
const evidenceDiagnosticsService = require('../services/evidenceDiagnosticsService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('EvidenceRoute');
const router = express.Router();

// Valid scope and provenance values for input validation
const VALID_SCOPES      = ['item_exact', 'genre', 'studio', 'franchise', 'certification'];
const VALID_PROVENANCES = ['human_confirmed', 'policy_confirmed', 'mined'];
const VALID_STATUSES    = ['active', 'candidate'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseIntParam(value, defaultValue, min = null, max = null) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  if (min !== null && parsed < min) return defaultValue;
  if (max !== null && parsed > max) return defaultValue;
  return parsed;
}

function sanitizeFilter(query) {
  return {
    scope:      VALID_SCOPES.includes(query.scope)           ? query.scope      : null,
    provenance: VALID_PROVENANCES.includes(query.provenance) ? query.provenance : null,
    status:     VALID_STATUSES.includes(query.status)        ? query.status     : null,
    libraryId:  query.libraryId ? parseIntParam(query.libraryId, null, 1) : null,
    mediaType:  typeof query.mediaType === 'string'          ? query.mediaType  : null
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/evidence/summary:
 *   get:
 *     summary: Aggregate counts by scope, provenance, and status
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await classificationEvidenceRepository.getSummary();
    res.json(summary);
  } catch (err) {
    logger.error('GET /evidence/summary failed', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve evidence summary' });
  }
});

/**
 * @swagger
 * /api/evidence:
 *   get:
 *     summary: Paginated, filtered evidence list
 *     parameters:
 *       - in: query
 *         name: scope
 *       - in: query
 *         name: provenance
 *       - in: query
 *         name: status
 *       - in: query
 *         name: libraryId
 *       - in: query
 *         name: mediaType
 *       - in: query
 *         name: limit        (max 200, default 50)
 *       - in: query
 *         name: offset       (default 0)
 */
router.get('/', async (req, res) => {
  try {
    const filter = sanitizeFilter(req.query);
    const limit  = parseIntParam(req.query.limit, 50, 1, 200);
    const offset = parseIntParam(req.query.offset, 0, 0);

    const { rows, total } = await classificationEvidenceRepository.findPaginated({
      ...filter,
      limit,
      offset
    });

    res.json({ rows, total, limit, offset });
  } catch (err) {
    logger.error('GET /evidence failed', { error: err.message });
    res.status(500).json({ error: 'Failed to list evidence' });
  }
});

/**
 * @swagger
 * /api/evidence/{id}:
 *   get:
 *     summary: Fetch a single evidence row by ID
 */
router.get('/:id', async (req, res) => {
  const id = parseIntParam(req.params.id, null, 1);
  if (!id) return res.status(400).json({ error: 'Invalid evidence ID' });

  try {
    const row = await classificationEvidenceRepository.findById(id);
    if (!row) return res.status(404).json({ error: 'Evidence row not found' });
    res.json(row);
  } catch (err) {
    logger.error('GET /evidence/:id failed', { id, error: err.message });
    res.status(500).json({ error: 'Failed to fetch evidence row' });
  }
});

/**
 * @swagger
 * /api/evidence/{id}/diagnose:
 *   get:
 *     summary: Operator diagnostic view for one evidence row
 */
router.get('/:id/diagnose', async (req, res) => {
  const id = parseIntParam(req.params.id, null, 1);
  if (!id) return res.status(400).json({ error: 'Invalid evidence ID' });

  try {
    const row = await classificationEvidenceRepository.findById(id);
    if (!row) return res.status(404).json({ error: 'Evidence row not found' });

    const diagnosis = await evidenceDiagnosticsService.diagnose(row);
    res.json({ evidence: row, diagnosis });
  } catch (err) {
    logger.error('GET /evidence/:id/diagnose failed', { id, error: err.message });
    res.status(500).json({ error: 'Failed to diagnose evidence row' });
  }
});

/**
 * @swagger
 * /api/evidence/{id}/decay:
 *   post:
 *     summary: Decay an evidence row (set status=candidate)
 */
router.post('/:id/decay', async (req, res) => {
  const id = parseIntParam(req.params.id, null, 1);
  if (!id) return res.status(400).json({ error: 'Invalid evidence ID' });

  try {
    const existing = await classificationEvidenceRepository.findById(id);
    if (!existing) return res.status(404).json({ error: 'Evidence row not found' });

    if (existing.status === 'candidate') {
      return res.json({ row: existing, changed: false, message: 'Row already in candidate status' });
    }

    const actor = req.user?.id ?? 'admin';
    const updated = await classificationEvidenceRepository.updateStatus({ id, status: 'candidate', actor });
    logger.info('Evidence row decayed', { id, actor });
    res.json({ row: updated, changed: true });
  } catch (err) {
    logger.error('POST /evidence/:id/decay failed', { id, error: err.message });
    res.status(500).json({ error: 'Failed to decay evidence row' });
  }
});

/**
 * @swagger
 * /api/evidence/{id}/promote:
 *   post:
 *     summary: Promote an evidence row (set status=active)
 */
router.post('/:id/promote', async (req, res) => {
  const id = parseIntParam(req.params.id, null, 1);
  if (!id) return res.status(400).json({ error: 'Invalid evidence ID' });

  try {
    const existing = await classificationEvidenceRepository.findById(id);
    if (!existing) return res.status(404).json({ error: 'Evidence row not found' });

    if (existing.status === 'active') {
      return res.json({ row: existing, changed: false, message: 'Row already active' });
    }

    const actor = req.user?.id ?? 'admin';
    const updated = await classificationEvidenceRepository.updateStatus({ id, status: 'active', actor });
    logger.info('Evidence row promoted', { id, actor });
    res.json({ row: updated, changed: true });
  } catch (err) {
    logger.error('POST /evidence/:id/promote failed', { id, error: err.message });
    res.status(500).json({ error: 'Failed to promote evidence row' });
  }
});

/**
 * @swagger
 * /api/evidence/purge:
 *   post:
 *     summary: Bulk purge evidence rows matching the supplied filters
 *     description: At least one filter (scope, provenance, status, libraryId, mediaType) is required.
 */
router.post('/purge', async (req, res) => {
  const filter = sanitizeFilter(req.body ?? {});
  const hasFilter = Object.values(filter).some(v => v !== null);

  if (!hasFilter) {
    return res.status(400).json({
      error: 'At least one filter (scope, provenance, status, libraryId, mediaType) is required'
    });
  }

  try {
    const result = await classificationEvidenceRepository.purgeByFilter(filter);
    const actor = req.user?.id ?? 'admin';
    logger.info('Evidence bulk purge completed', { filter, deleted: result.deleted, actor });
    res.json({ deleted: result.deleted, filter });
  } catch (err) {
    logger.error('POST /evidence/purge failed', { error: err.message });
    res.status(500).json({ error: 'Failed to purge evidence' });
  }
});

module.exports = router;
