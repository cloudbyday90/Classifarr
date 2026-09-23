/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { readLibraryProfileRefreshStatus } from '../services/libraryProfileRefreshStatus.mjs';

export function registerProfileRefreshStatusRoutes(router, { db }) {
    router.get('/profile-refresh-status', (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    }, requireAdmin, rateLimit(libraryObservationHealthLimiterConfig),
        asyncHandler(async (req, res) => {
            if (Object.keys(req.query).length) {
                throw new ValidationError('Profile refresh status does not accept query parameters');
            }
            res.json(await readLibraryProfileRefreshStatus(db));
        }));
}
