/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { canonicalDatabaseBigintId } from '../services/databaseIntegerValues.mjs';
import { ValidationError } from '../utils/appError.mjs';

function requireClassificationId(value) {
  const id = canonicalDatabaseBigintId(value);
  if (id === null) throw new ValidationError('Valid classification ID is required', { code: 'invalid_classification_id' });
  return id;
}

export function registerManualRoutingCheckRoute(router, { requireAdmin, limiter, service }) {
  router.post('/manual-routing/:id/check', requireAdmin, limiter, asyncHandler(async (req, res) => {
    const id = requireClassificationId(req.params.id);
    res.set('Cache-Control', 'no-store');
    res.vary('Authorization');
    const result = await service.check(id);
    return sendData(res, result, ['busy', 'cooldown'].includes(result.reason) ? 429 : result.reason === 'not_found' ? 404 : 200);
  }));
  router.get('/manual-routing/:id/background', requireAdmin, limiter, asyncHandler(async (req, res) => {
    const id = requireClassificationId(req.params.id);
    res.set('Cache-Control', 'no-store'); res.vary('Authorization');
    return sendData(res, await service.read(id));
  }));
  router.post('/manual-routing/:id/background', requireAdmin, limiter, asyncHandler(async (req, res) => {
    const id = requireClassificationId(req.params.id);
    if (typeof req.body?.enabled !== 'boolean' || Object.keys(req.body).length !== 1) {
      throw new ValidationError('Only a boolean enabled value is accepted');
    }
    res.set('Cache-Control', 'no-store'); res.vary('Authorization');
    const result = await service.setEnabled(id, req.body.enabled);
    return sendData(res, result, result.reason ? 409 : 200);
  }));
}
