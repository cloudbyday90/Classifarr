/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { ForbiddenError, ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { createLibraryDiscoveryStatusRepository } from '../services/libraryDiscoveryStatusRepository.mjs';
import { presentLibraryDiscovery } from '../services/libraryDiscoveryPresentation.mjs';

export function registerLibraryDiscoveryRoutes(router, { db }) {
  router.get('/discovery-status', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.apiKey || req.headers['x-api-key'] !== undefined || req.user?.role !== 'admin' ||
        req.user?.type !== 'access' || req.user?.token_use) throw new ForbiddenError('An administrator access session is required');
    if (Object.keys(req.query).length) throw new ValidationError('Discovery status does not accept query parameters');
    next();
  }, rateLimit({ ...libraryObservationHealthLimiterConfig,
    message: { error: 'Too many discovery status requests. Wait before refreshing again.' },
  }), asyncHandler(async (_req, res) => {
    res.json(presentLibraryDiscovery(await createLibraryDiscoveryStatusRepository(db).read()));
  }));
}
