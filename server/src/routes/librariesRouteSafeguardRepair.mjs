/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { ForbiddenError, ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { createIngestionSafeguardRepair } from '../services/ingestionSafeguardRepair.mjs';

export function registerSafeguardRepairRoutes(router, { db, service = createIngestionSafeguardRepair(db) }) {
  const base = '/ingestion-safeguards';
  router.use(base, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.apiKey || req.headers['x-api-key'] !== undefined || req.user?.role !== 'admin' ||
      req.user?.type !== 'access' || req.user?.token_use) throw new ForbiddenError('An administrator access session is required');
    if (Object.keys(req.query).length) throw new ValidationError('Repair does not accept query parameters');
    next();
  }, rateLimit({ ...libraryObservationHealthLimiterConfig, max: 12 }));
  router.get(base, asyncHandler(async (req, res) => res.json(await service.preview(req.user.id))));
  router.post(base, rateLimit({ ...libraryObservationHealthLimiterConfig, max: 3 }),
    asyncHandler(async (req, res) => res.json(await service.apply(req.user.id, req.body))));
}
