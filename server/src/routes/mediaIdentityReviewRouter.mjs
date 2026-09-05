/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import express from 'express';
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
  router.get('/:itemId/receipts/:previewId', async (req, res) => res.json(await service.getReceipt(req.reviewActorId, req.params.itemId, req.params.previewId)));
  router.post('/:itemId/preview', async (req, res) => res.json(await service.preview(req.reviewActorId, req.params.itemId, req.body)));
  router.post('/:itemId/confirm', async (req, res) => res.json(await service.confirm(req.reviewActorId, req.params.itemId, req.body)));
  return router;
}
