import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

export function registerHealthProbeRoutes(router, { healthCheckService }) {
  router.get('/health/live', (_req, res) => {
    sendData(res, {
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/health/ready', asyncHandler(async (_req, res) => {
    let dbHealth;
    try {
      dbHealth = await healthCheckService.checkDatabase();
    } catch (error) {
      return sendData(res, {
        status: 'not_ready',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      }, 503);
    }

    const isReady = dbHealth.status === 'connected';

    return sendData(res, {
      status: isReady ? 'ready' : 'not_ready',
      database: dbHealth.status,
      timestamp: new Date().toISOString(),
    }, isReady ? 200 : 503);
  }));

  router.get('/health/memory', (_req, res) => {
    const memory = healthCheckService.checkProcessMemory();
    sendData(res, memory, memory.status === 'critical' ? 503 : 200);
  });
}
