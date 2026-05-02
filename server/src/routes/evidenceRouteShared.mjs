/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  parseIntParam,
  sanitizeFilter,
} from './evidenceRouteHelpers.mjs';

export function createEvidenceRouter({
  express,
  classificationEvidenceRepository,
  evidenceDiagnosticsService,
  logger,
}) {
  const router = express.Router();

  router.get('/summary', async (req, res) => {
    try {
      const summary = await classificationEvidenceRepository.getSummary();
      res.json(summary);
    } catch (err) {
      logger.error('GET /evidence/summary failed', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve evidence summary' });
    }
  });

  router.get('/', async (req, res) => {
    try {
      const filter = sanitizeFilter(req.query);
      const limit = parseIntParam(req.query.limit, 50, 1, 200);
      const offset = parseIntParam(req.query.offset, 0, 0);

      const { rows, total } = await classificationEvidenceRepository.findPaginated({
        ...filter,
        limit,
        offset,
      });

      res.json({ rows, total, limit, offset });
    } catch (err) {
      logger.error('GET /evidence failed', { error: err.message });
      res.status(500).json({ error: 'Failed to list evidence' });
    }
  });

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

  router.post('/purge', async (req, res) => {
    const filter = sanitizeFilter(req.body ?? {});
    const hasFilter = Object.values(filter).some((value) => value !== null);

    if (!hasFilter) {
      return res.status(400).json({
        error: 'At least one filter (scope, provenance, status, libraryId, mediaType) is required',
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

  return router;
}
