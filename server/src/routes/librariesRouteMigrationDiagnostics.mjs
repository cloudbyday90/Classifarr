/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { ForbiddenError, ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { createMigrationDiagnosticReader } from '../services/migrationDiagnosticReader.mjs';

export function registerMigrationDiagnosticRoutes(router, { db, read = createMigrationDiagnosticReader(db) }) {
  router.get('/migration-diagnostics', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.apiKey || req.headers['x-api-key'] !== undefined || req.user?.role !== 'admin' ||
      req.user?.type !== 'access' || req.user?.token_use) throw new ForbiddenError('An administrator access session is required');
    if (Object.keys(req.query).length) throw new ValidationError('Migration diagnostics do not accept query parameters');
    next();
  }, rateLimit({ ...libraryObservationHealthLimiterConfig, max: 12 }),
  asyncHandler(async (req, res) => res.json(await read(req.user.id))));
}
