/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createEvaluationWorkloadRepository } from '../services/evaluationWorkloadRepository.mjs';

export function registerEvaluationWorkloadRoutes(router, { db, requireAdmin, rateLimit }) {
  if (typeof requireAdmin !== 'function' || typeof rateLimit !== 'function') throw new TypeError('Workload controls require protected access');
  const workload = createEvaluationWorkloadRepository(db);
  const headers = (_req,res,next) => { res.set('Cache-Control','no-store'); next(); };
  const limited = limit => rateLimit({ windowMs: 60_000,limit,standardHeaders: true,legacyHeaders: false });
  router.get('/evaluation-workload',headers,requireAdmin,limited(30),async (req,res) => {
    if (Object.keys(req.query).length) return res.status(400).json({ error: 'evaluation_workload_invalid' });
    try { return res.json(await workload.read()); }
    catch { return res.status(503).json({ error: 'evaluation_workload_unavailable' }); }
  });
  router.put('/evaluation-workload',headers,requireAdmin,limited(10),async (req,res) => {
    if (Object.keys(req.query).length) return res.status(400).json({ error: 'evaluation_workload_invalid' });
    try { return res.json(await workload.configure(req.body)); }
    catch (error) {
      if (error.message === 'evaluation_workload_invalid') return res.status(400).json({ error: error.message });
      if (error.message === 'evaluation_workload_conflict') return res.status(409).json({ error: error.message });
      return res.status(503).json({ error: 'evaluation_workload_unavailable' });
    }
  });
}
