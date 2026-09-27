/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { ForbiddenError, ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { createLibraryArchiveService } from '../services/libraryArchiveService.mjs';

export function registerLibraryArchiveRoutes(router, { db, getMediaServerServiceByType, service = createLibraryArchiveService(db, getMediaServerServiceByType) }) {
  const base = '/libraries/:id/archive';
  router.use(base, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.apiKey || req.headers['x-api-key'] !== undefined || req.user?.role !== 'admin' ||
        req.user?.type !== 'access' || req.user?.token_use) throw new ForbiddenError('An administrator access session is required');
    if (Object.keys(req.query).length) throw new ValidationError('Archive review does not accept query parameters');
    next();
  }, rateLimit({ ...libraryObservationHealthLimiterConfig, max: 12,
    message: { error: 'Too many archive review requests. Wait before checking or confirming again.' },
  }));
  router.get(base, asyncHandler(async (req, res) => {
    const preview = await service.preview(req.user.id, req.params.id);
    res.set('ETag', preview.revision).json(preview);
  }));
  router.post(base, asyncHandler(async (req, res) => {
    res.json(await service.confirm(req.user.id, req.params.id, req.body, req.get('If-Match')));
  }));
  router.get(`${base}/receipts/:requestId`, asyncHandler(async (req, res) => {
    res.json(await service.receipt(req.user.id, req.params.id, req.params.requestId));
  }));
}
