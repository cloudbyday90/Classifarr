/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { requireValidPositiveInt } from './routeHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';

export function registerManualRoutingCheckRoute(router, { requireAdmin, limiter, service }) {
  router.post('/manual-routing/:id/check', requireAdmin, limiter, asyncHandler(async (req, res) => {
    const id = requireValidPositiveInt(req.params.id, 'classification ID', 'invalid_classification_id');
    res.set('Cache-Control', 'no-store');
    res.vary('Authorization');
    const result = await service.check(id);
    return sendData(res, result, ['busy', 'cooldown'].includes(result.reason) ? 429 : result.reason === 'not_found' ? 404 : 200);
  }));
  router.get('/manual-routing/:id/background', requireAdmin, limiter, asyncHandler(async (req, res) => {
    const id = requireValidPositiveInt(req.params.id, 'classification ID', 'invalid_classification_id');
    res.set('Cache-Control', 'no-store'); res.vary('Authorization');
    return sendData(res, await service.read(id));
  }));
  router.post('/manual-routing/:id/background', requireAdmin, limiter, asyncHandler(async (req, res) => {
    const id = requireValidPositiveInt(req.params.id, 'classification ID', 'invalid_classification_id');
    if (typeof req.body?.enabled !== 'boolean' || Object.keys(req.body).length !== 1) {
      throw new ValidationError('Only a boolean enabled value is accepted');
    }
    res.set('Cache-Control', 'no-store'); res.vary('Authorization');
    const result = await service.setEnabled(id, req.body.enabled);
    return sendData(res, result, result.reason ? 409 : 200);
  }));
}
