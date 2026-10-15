/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readOllamaWorkHistory } from '../services/ollamaWorkHistory.mjs';

export function createGatewayHistoryHandler({ read = readOllamaWorkHistory } = {}) {
  return async (req,res) => {
    const controller = new AbortController(),cancel = () => controller.abort();
    req.once('aborted',cancel); res.once('close',cancel);
    res.set('Cache-Control','no-store');
    try {
      const result = await read(req.query,controller.signal);
      if (!controller.signal.aborted) res.json(result);
    } catch (error) {
      if (!controller.signal.aborted) {
        const invalid = error?.code === 'gateway_history_query_invalid';
        res.status(invalid ? 400 : 503).json({ error: invalid ? 'gateway_history_query_invalid' : 'gateway_history_unavailable' });
      }
    } finally { req.removeListener('aborted',cancel); res.removeListener('close',cancel); }
  };
}

export function registerGatewayHistoryRoutes(router,{ authenticateToken,requireAdmin }) {
  router.get('/ollama/gateway-history',authenticateToken,requireAdmin,createGatewayHistoryHandler());
}
