/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { libraryObservationHealthLimiterConfig } from '../config/rateLimits.mjs';
import { readEvidenceGapAuditStatus } from '../services/evidenceGapAuditStatus.mjs';

/** Optional saved aggregate, isolated from history availability; GET never starts the job. */
export function registerEvidenceGapAuditRoutes(router, { db, requireAdmin, rateLimit }) {
  if (typeof requireAdmin !== 'function' || typeof rateLimit !== 'function') throw new TypeError('Gap audit requires protected access');
  router.get('/evidence-gap-audit', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); },
    requireAdmin, rateLimit(libraryObservationHealthLimiterConfig), async (req, res) => {
      if (Object.keys(req.query).length) return res.status(400).json({ error: 'Evidence gap audit does not accept query parameters' });
      try { return res.json(await readEvidenceGapAuditStatus(db)); }
      catch { return res.status(503).json({ error: 'Evidence gap audit is unavailable' }); }
    });
}
