/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { readLibraryUpgradeReadiness } from '../services/libraryUpgradeReadiness.mjs';

export function registerUpgradeReadinessRoutes(router, { db }) {
    router.get('/upgrade-readiness', (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    }, requireAdmin, rateLimit(libraryObservationHealthLimiterConfig), asyncHandler(async (req, res) => {
        if (Object.keys(req.query).length) throw new ValidationError('Upgrade readiness does not accept query parameters');
        res.json(await readLibraryUpgradeReadiness(db));
    }));
}
