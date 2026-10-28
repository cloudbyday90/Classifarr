/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/apiKeyAuth.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { createFeedbackReviewService } from '../services/feedbackReviewService.mjs';

export function registerFeedbackReviewRoutes(router, { db, feedbackAnalysis }) {
  const service = createFeedbackReviewService({ db, feedbackAnalysis });
  const limit = rateLimit({ windowMs: 900000, max: 60, standardHeaders: true, legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', message: { error: 'Too many feedback reviews. Try again later.' } });
  const protect = [(_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, requireAdmin, limit,
    (req, _res, next) => { if (Object.keys(req.query).length) throw new ValidationError('Feedback review does not accept query parameters'); next(); }];
  router.post('/:id/review', ...protect, asyncHandler(async (req, res) => {
    res.json(await service.prepare(req.user?.id, req.params.id, req.body));
  }));
  router.post('/:id/review/submit', ...protect, asyncHandler(async (req, res) => {
    const result = await service.submit(req.user?.id, req.params.id, req.body);
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.get('/:id/review/:reviewId/receipt', ...protect, asyncHandler(async (req, res) => {
    res.json(await service.receipt(req.user?.id, req.params.id, req.params.reviewId));
  }));
}
