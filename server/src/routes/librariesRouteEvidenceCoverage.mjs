/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { readLibraryEvidenceCoverage } from '../services/libraryEvidenceCoverageService.mjs';

export function registerLibraryEvidenceCoverageRoutes(router, { db }) {
  router.get('/:id/evidence-coverage', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, requireAdmin, rateLimit(libraryObservationHealthLimiterConfig), asyncHandler(async (req, res) => {
    if (Object.keys(req.query).length) throw new ValidationError('Evidence coverage does not accept query parameters');
    if (typeof req.params.id !== 'string' || !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(Number(req.params.id))) throw new ValidationError('Invalid library ID');
    res.json(await readLibraryEvidenceCoverage(db, Number(req.params.id)));
  }));
}
