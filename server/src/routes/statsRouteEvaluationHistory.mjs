/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { readEvaluationHistory } from '../services/evaluationHistoryRepository.mjs';

/** Versioned aggregate only: v3 adds pair origins; access and no-store guarantees are unchanged. */
export function registerEvaluationHistoryRoutes(router, { db, requireAdmin, rateLimit }) {
  if (typeof requireAdmin !== 'function' || typeof rateLimit !== 'function') throw new TypeError('Evaluation history requires protected access');
  router.get('/evaluation-history', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    requireAdmin, rateLimit(libraryObservationHealthLimiterConfig), async (req, res) => {
      if (Object.keys(req.query).length) return res.status(400).json({ error: 'Evaluation history does not accept query parameters' });
      try { return res.json(await readEvaluationHistory(db)); }
      catch { return res.status(503).json({ error: 'Evaluation history is unavailable' }); }
    });
}
