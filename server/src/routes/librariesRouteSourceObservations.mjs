/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { readSourceObservationSummary } from '../services/mediaSourceObservationSummary.mjs';

export function registerSourceObservationRoutes(router, { db }) {
  router.get('/source-observations', (req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  }, rateLimit(libraryObservationHealthLimiterConfig), asyncHandler(async (req, res) => {
    if (Object.keys(req.query).length) throw new ValidationError('Source observations do not accept query parameters');
    res.json(await readSourceObservationSummary(db));
  }));
}
