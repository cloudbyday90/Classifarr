/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendError } from '../utils/responseHelpers.mjs';

export function registerRetryReadinessRoute(router, { requireAdmin, limiter, service }) {
  router.get('/retry-readiness', requireAdmin, limiter, asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.vary('Authorization');
    try { return sendData(res, await service.getReport()); }
    catch { return sendError(res, 'Retry readiness is unavailable. Try again later.', 503); }
  }));
}
