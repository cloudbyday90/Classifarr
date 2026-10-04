/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { AppError, AuthenticationError, ServiceUnavailableError, ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { createCustomPresetSaveService } from '../services/customPresetSaveService.mjs';

function saveHandler(handler) {
  return asyncHandler(async (req, res) => {
    try { return await handler(req, res); }
    catch (error) {
      if (error instanceof AppError) throw error;
      // A database error can contain draft values. Keep it out of generic HTTP
      // error logs/responses, including development-mode diagnostics.
      throw new ServiceUnavailableError('Preset save could not be confirmed', { code: 'PRESET_SAVE_UNAVAILABLE' });
    }
  });
}

export function mountCustomPresetSaveRoutes(router, { db }) {
  const service = createCustomPresetSaveService({ db });
  const base = '/custom/save-requests';
  router.use(base, (req, res, next) => {
    if (!Number.isSafeInteger(req.user?.id) || req.user.id <= 0 || req.user.id > 2147483647) return next(new AuthenticationError('Authentication required'));
    res.set('Cache-Control', 'no-store');
    return next();
  });
  router.get(base, saveHandler(async (req, res) => sendData(res, { request: await service.pending(req.user.id) })));
  router.post(base, saveHandler(async (req, res) => sendData(res, await service.begin(req.user.id), 201)));
  for (const action of ['complete', 'resolve']) {
    router.post(`${base}/:requestId/${action}`, saveHandler(async (req, res) => {
      const { requestId } = req.params;
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) {
        throw new ValidationError('Invalid save request ID');
      }
      const result = action === 'complete'
        ? await service.complete(req.user.id, requestId, req.body)
        : await service.resolve(req.user.id, requestId);
      return sendData(res, result);
    }));
  }
}
