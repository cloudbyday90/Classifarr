/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { databaseHealthSummaryLimiterConfig } from '../config/rateLimits.mjs';
import { createImageIndexProgressService } from '../services/imageIndexProgressService.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

export function registerImageIndexProgressRoutes(router, { db, requireAdmin, rateLimit,
  createService = createImageIndexProgressService }) {
  if (typeof requireAdmin !== 'function' || typeof rateLimit !== 'function') {
    throw new TypeError('Image-index progress requires administrator authorization and rate limiting');
  }
  const service = createService({ database: db });
  router.get('/image-index-progress', requireAdmin, rateLimit(databaseHealthSummaryLimiterConfig),
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      if (Object.keys(req.query).length) throw new ValidationError('Image-index progress accepts no query parameters');
      return sendData(res, await service.getReport());
    }));
}
