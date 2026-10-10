/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import express from 'express';
import rateLimit from 'express-rate-limit';
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { ForbiddenError } from '../utils/appError.mjs';
import { reviewInteger } from '../services/mediaIdentityReviewContract.mjs';

export function createMediaIdentityReviewRouter({ authenticateToken, requireAdmin, service }) {
  const router = express.Router();
  router.use(authenticateToken, requireAdmin, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers['x-api-key'] !== undefined || req.user?.type !== 'access' || req.user?.token_use) {
      throw new ForbiddenError('An administrator access session is required');
    }
    req.reviewActorId = reviewInteger(req.user.id);
    next();
  });
  router.get('/', async (req, res) => res.json(await service.list(req.reviewActorId, req.query)));
  router.get('/source-scopes/mappings', async (req, res) => res.json(await service.listSourceMappings(req.reviewActorId, req.query)));
  router.post('/source-scopes/mappings/:mappingId/revoke', rateLimit(libraryObservationHealthLimiterConfig),
    async (req, res) => res.json(await service.revokeSourceMapping(req.reviewActorId, req.params.mappingId, req.body)));
  router.post('/source-scopes/:key/approve', rateLimit({ ...libraryObservationHealthLimiterConfig, max: 5 }),
    async (req, res) => {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      res.once('close', cancel);
      try {
        const result = await service.approveSourceScope(req.reviewActorId, req.params.key, req.body, controller.signal);
        if (!controller.signal.aborted) res.json(result);
      } finally { res.removeListener('close', cancel); }
    });
  router.post('/source-scopes/:key/review', rateLimit(libraryObservationHealthLimiterConfig),
    async (req, res) => res.json(await service.reviewSourceScope(req.reviewActorId, req.params.key, req.body)));
  router.post('/source-scopes/:key/evidence', rateLimit({ ...libraryObservationHealthLimiterConfig, max: 5,
    message: { error: 'Too many evidence checks. Wait before trying again.' } }),
    async (req, res) => {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      res.once('close', cancel);
      try {
        const result = await service.inspectSourceScope(req.reviewActorId, req.params.key, req.body, controller.signal);
        if (!controller.signal.aborted) res.json(result);
      } finally { res.removeListener('close', cancel); }
    });
  router.get('/:itemId/receipts/:previewId', async (req, res) => res.json(await service.getReceipt(req.reviewActorId, req.params.itemId, req.params.previewId)));
  router.post('/:itemId/preview', async (req, res) => res.json(await service.preview(req.reviewActorId, req.params.itemId, req.body)));
  router.post('/:itemId/confirm', async (req, res) => res.json(await service.confirm(req.reviewActorId, req.params.itemId, req.body)));
  return router;
}
