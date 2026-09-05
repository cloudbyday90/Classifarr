/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { readLibraryOverlap } from '../services/libraryOverlapService.mjs';
import rateLimit from 'express-rate-limit';
import { libraryOverlapLimiterConfig } from '../config/rateLimits.mjs';

export function registerOverlapRoutes(router, { db }) {
    router.get('/overlap', (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    }, rateLimit(libraryOverlapLimiterConfig), asyncHandler(async (req, res) => {
        if (Object.keys(req.query).length) throw new ValidationError('Library overlap does not accept query parameters');
        res.json(await readLibraryOverlap(db));
    }));
}
