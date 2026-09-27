/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { ForbiddenError } from '../utils/appError.mjs';
import { reviewInteger } from '../services/mediaIdentityReviewContract.mjs';

export function createInventoryRecoveryRouter({ authenticateToken, requireAdmin, service }) {
    const router = express.Router();
    router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    router.use(authenticateToken, requireAdmin, (req, _res, next) => {
        if (req.headers['x-api-key'] !== undefined || req.user?.type !== 'access' || req.user?.token_use) {
            throw new ForbiddenError('An administrator access session is required');
        }
        req.recoveryActorId = reviewInteger(req.user.id);
        next();
    }, rateLimit({ ...libraryObservationHealthLimiterConfig, max: 120,
        message: { error: 'Too many recovery reads. Try again later.' } }));
    router.get('/', async (req, res) => res.json(await service.list(req.recoveryActorId, req.query)));
    router.get('/:itemId/:caseId/plex-link', async (req, res) => res.json(
        await service.plexLink(req.recoveryActorId, req.params.itemId, req.params.caseId, req.query)));
    return router;
}
