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
import { requireValidId } from './routeHelpers.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';

export function createEvidenceRouter({
  express,
  classificationEvidenceRepository,
  evidenceDiagnosticsService,
  logger,
}) {
  const router = express.Router();

  router.get('/summary', asyncHandler(async (_req, res) => {
    const summary = await classificationEvidenceRepository.getSummary();
    return sendData(res, summary);
  }));

  router.get('/', asyncHandler(async (req, res) => {
    const filter = sanitizeFilter(req.query);
    const limit = parseIntParam(req.query.limit, 50, 1, 200);
    const offset = parseIntParam(req.query.offset, 0, 0);

    const { rows, total } = await classificationEvidenceRepository.findPaginated({
      ...filter,
      limit,
      offset,
    });

    return res.json({ rows, total, limit, offset });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'evidence ID');

    const row = await classificationEvidenceRepository.findById(id);
    if (!row) throw new NotFoundError('Evidence row not found');
    return sendData(res, row);
  }));

  router.get('/:id/diagnose', asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'evidence ID');

    const row = await classificationEvidenceRepository.findById(id);
    if (!row) throw new NotFoundError('Evidence row not found');

    const diagnosis = await evidenceDiagnosticsService.diagnose(row);
    return sendData(res, { evidence: row, diagnosis });
  }));

  router.post('/:id/decay', asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'evidence ID');

    const existing = await classificationEvidenceRepository.findById(id);
    if (!existing) throw new NotFoundError('Evidence row not found');

    if (existing.status === 'candidate') {
      return res.json({ row: existing, changed: false, message: 'Row already in candidate status' });
    }

    const actor = req.user?.id ?? 'admin';
    const updated = await classificationEvidenceRepository.updateStatus({ id, status: 'candidate', actor });
    logger.info('Evidence row decayed', { id, actor });
    return res.json({ row: updated, changed: true });
  }));

  router.post('/:id/promote', asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'evidence ID');

    const existing = await classificationEvidenceRepository.findById(id);
    if (!existing) throw new NotFoundError('Evidence row not found');

    if (existing.status === 'active') {
      return res.json({ row: existing, changed: false, message: 'Row already active' });
    }

    const actor = req.user?.id ?? 'admin';
    const updated = await classificationEvidenceRepository.updateStatus({ id, status: 'active', actor });
    logger.info('Evidence row promoted', { id, actor });
    return res.json({ row: updated, changed: true });
  }));

  router.post('/purge', asyncHandler(async (req, res) => {
    const filter = sanitizeFilter(req.body ?? {});
    const hasFilter = Object.values(filter).some((value) => value !== null);

    if (!hasFilter) {
      throw new ValidationError('At least one filter (scope, provenance, status, libraryId, mediaType) is required');
    }

    const result = await classificationEvidenceRepository.purgeByFilter(filter);
    const actor = req.user?.id ?? 'admin';
    logger.info('Evidence bulk purge completed', { filter, deleted: result.deleted, actor });
    return res.json({ deleted: result.deleted, filter });
  }));

  return router;
}
