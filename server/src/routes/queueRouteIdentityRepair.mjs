/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { ForbiddenError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

export function registerQueueIdentityRepairRoutes(router, { requireAdmin, limiter, readLimiter, service }) {
  const session = (req, res, next) => {
    res.set('Cache-Control', 'no-store'); res.vary('Authorization'); res.vary('Cookie');
    if (req.headers['x-api-key'] !== undefined || req.user?.type !== 'access' || req.user?.token_use) {
      throw new ForbiddenError('An administrator access session is required');
    }
    next();
  };
  const path = '/task/:id/identity-repair';
  router.get(path, requireAdmin, session, readLimiter, asyncHandler(async (req, res) =>
    sendData(res, await service.receipt(req.user.id, req.params.id))));
  for (const action of ['preview', 'confirm', 'retry']) {
    router.post(`${path}/${action}`, requireAdmin, session, limiter, asyncHandler(async (req, res) => {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      res.once('close', cancel);
      try {
        const result = await service[action](req.user.id, req.params.id, req.body, controller.signal);
        if (!controller.signal.aborted) return sendData(res, result);
      } finally { res.removeListener('close', cancel); }
    }));
  }
}
