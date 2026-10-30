/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { readPurposeEvaluationStatus } from '../services/purposeEvaluationStatus.mjs';

/** Saved aggregate only. Polling never reads item evidence or starts background work. */
export function registerPurposeEvaluationRoutes(router, { db, requireAdmin, rateLimit }) {
  if (typeof requireAdmin !== 'function' || typeof rateLimit !== 'function') throw new TypeError('Purpose summary requires protected access');
  router.get('/purpose-evaluation', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    requireAdmin, rateLimit(libraryObservationHealthLimiterConfig), async (req, res) => {
      if (Object.keys(req.query).length) return res.status(400).json({ error: 'Destination review summary does not accept query parameters' });
      try { return res.json(await readPurposeEvaluationStatus(db)); }
      catch { return res.status(503).json({ error: 'Destination review summary is unavailable' }); }
    });
}
