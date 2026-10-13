/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ForbiddenError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

export function registerQueueMetadataCheckRoute(router, { requireAdmin, limiter, service }) {
  router.post('/task/:id/metadata-check', requireAdmin, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.vary('Authorization');
    res.vary('Cookie');
    if (req.headers['x-api-key'] !== undefined || req.user?.type !== 'access' || req.user?.token_use) {
      throw new ForbiddenError('An administrator access session is required');
    }
    next();
  }, limiter, asyncHandler(async (req, res) => {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.once('close', cancel);
    try {
      const report = await service.check(req.user.id, req.params.id, req.body, controller.signal);
      if (!controller.signal.aborted) return sendData(res, report);
    } finally { res.removeListener('close', cancel); }
  }));
}
