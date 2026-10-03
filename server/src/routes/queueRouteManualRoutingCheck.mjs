/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { requireValidPositiveInt } from './routeHelpers.mjs';

export function registerManualRoutingCheckRoute(router, { requireAdmin, limiter, service }) {
  router.post('/manual-routing/:id/check', requireAdmin, limiter, asyncHandler(async (req, res) => {
    const id = requireValidPositiveInt(req.params.id, 'classification ID', 'invalid_classification_id');
    res.set('Cache-Control', 'no-store');
    res.vary('Authorization');
    const result = await service.check(id);
    return sendData(res, result, result.reason === 'busy' ? 429 : result.reason === 'not_found' ? 404 : 200);
  }));
}
