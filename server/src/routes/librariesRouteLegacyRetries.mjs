/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { ForbiddenError, ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { createLegacyEnrichmentRetryService } from '../services/legacyEnrichmentRetryService.mjs';
import { enrichmentRetryService } from '../services/enrichmentRetryService.mjs';

export function registerLegacyRetryRoutes(router, { db, service = createLegacyEnrichmentRetryService(db, {
  onRecovered: () => enrichmentRetryService.scheduleProcessing(),
}) }) {
  const base = '/:id/legacy-enrichment-retries';
  router.use(base, (_req, res, next) => { res.set('Cache-Control', 'no-store'); res.vary('Authorization'); next(); }, (req, _res, next) => {
    if (req.apiKey || req.headers['x-api-key'] !== undefined || req.user?.role !== 'admin' ||
        req.user?.type !== 'access' || req.user?.token_use) throw new ForbiddenError('An administrator access session is required');
    if (Object.keys(req.query).length) throw new ValidationError('Recovery does not accept query parameters');
    next();
  }, rateLimit({ ...libraryObservationHealthLimiterConfig, max: 30 }));
  router.get(base, asyncHandler(async (req, res) => {
    const result = await service.preview(req.user.id, req.params.id);
    res.set('ETag', result.revision).json(result);
  }));
  router.get(`${base}/receipts/:requestId`, asyncHandler(async (req, res) => {
    res.json(await service.receipt(req.user.id, req.params.id, req.params.requestId));
  }));
  router.post(base, rateLimit({ ...libraryObservationHealthLimiterConfig, max: 6 }), asyncHandler(async (req, res) => {
    res.json(await service.confirm(req.user.id, req.params.id, req.body, req.get('If-Match')));
  }));
}
