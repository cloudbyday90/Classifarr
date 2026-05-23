import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

export function mapServiceStatus(status) {
  switch (status) {
    case 'connected':
    case 'configured':
    case 'available':
      return 'healthy';
    case 'partial':
    case 'degraded':
    case 'circuit_open':
      return 'degraded';
    case 'error':
    case 'disconnected':
    case 'unavailable':
    case 'not configured':
    case 'not_configured':
      return 'unhealthy';
    case 'disabled':
      return 'unknown';
    default:
      return 'unknown';
  }
}

export function registerHealthCheckRoutes(router, { healthCheckService, appVersion }) {
  router.get('/health', asyncHandler(async (req, res) => {
    const forceRefresh = req.query.refresh === 'true';

    let health;
    if (forceRefresh) {
      health = await healthCheckService.runAllHealthChecks();
    } else {
      health = healthCheckService.getHealthCache();
      if (!health.database.lastCheck) {
        health = await healthCheckService.runAllHealthChecks();
      }
    }

    const queueWorker = await healthCheckService.checkQueueWorker();
    const dbHealth = health.database;
    const isHealthy = dbHealth.status === 'connected';
    const uptime = healthCheckService.getUptime();

    return sendData(res, {
      status: isHealthy ? 'healthy' : 'unhealthy',
      version: appVersion,
      uptime,
      database: dbHealth.status,
      mediaServer: health.mediaServer?.status || 'unknown',
      radarr: health.radarr?.status || 'unknown',
      sonarr: health.sonarr?.status || 'unknown',
      ollama: health.ollama?.status || 'unknown',
      rag: health.rag?.status || 'unknown',
      tmdb: health.tmdb?.status || 'unknown',
      omdb: health.omdb?.status || 'unknown',
      discordBot: health.discordBot?.status || 'unknown',
      tavily: health.tavily?.status || 'unknown',
      imageEmbeddings: health.imageEmbeddings?.status || 'unknown',
      queueWorker: queueWorker.status,
      details: {
        database: dbHealth,
        mediaServer: health.mediaServer,
        radarr: health.radarr,
        sonarr: health.sonarr,
        ollama: health.ollama,
        rag: health.rag,
        imageEmbeddings: health.imageEmbeddings,
        tmdb: health.tmdb,
        omdb: health.omdb,
        discordBot: health.discordBot,
        tavily: health.tavily,
        queueWorker,
      },
      timestamp: new Date().toISOString(),
    }, isHealthy ? 200 : 503);
  }));

  router.get('/health/services', asyncHandler(async (_req, res) => {
    let services;
    try {
      services = await healthCheckService.getAllServicesHealth();
    } catch (error) {
      return sendError(res, 'Failed to check service health', 500, { message: error.message });
    }

    const allServices = [];

    if (services.database && services.database.status !== 'not configured') {
      const dbService = {
        name: 'PostgreSQL',
        status: mapServiceStatus(services.database.status),
        latency: services.database.responseTime || 0,
        timestamp: services.database.lastCheck,
      };
      if (services.database.error !== undefined) {
        dbService.error = services.database.error;
      }
      allServices.push(dbService);
    }

    if (services.mediaServer && services.mediaServer.status !== 'not configured') {
      const mediaService = {
        name: services.mediaServer.type || 'Media Server',
        status: mapServiceStatus(services.mediaServer.status),
        latency: services.mediaServer.responseTime || 0,
        timestamp: services.mediaServer.lastCheck,
      };
      if (services.mediaServer.error !== undefined) {
        mediaService.error = services.mediaServer.error;
      }
      allServices.push(mediaService);
    }

    if (services.radarr && services.radarr.instances && services.radarr.instances.length > 0) {
      services.radarr.instances.forEach((instance) => {
        const radarrService = {
          name: `Radarr (${instance.name})`,
          status: mapServiceStatus(instance.status),
          latency: instance.responseTime || 0,
          timestamp: services.radarr.lastCheck,
        };
        if (instance.error !== undefined) {
          radarrService.error = instance.error;
        }
        allServices.push(radarrService);
      });
    }

    if (services.sonarr && services.sonarr.instances && services.sonarr.instances.length > 0) {
      services.sonarr.instances.forEach((instance) => {
        const sonarrService = {
          name: `Sonarr (${instance.name})`,
          status: mapServiceStatus(instance.status),
          latency: instance.responseTime || 0,
          timestamp: services.sonarr.lastCheck,
        };
        if (instance.error !== undefined) {
          sonarrService.error = instance.error;
        }
        allServices.push(sonarrService);
      });
    }

    if (services.aiProvider && services.aiProvider.status !== 'not configured') {
      const aiService = {
        name: services.aiProvider.provider || 'AI Provider',
        status: mapServiceStatus(services.aiProvider.status),
        latency: services.aiProvider.responseTime || 0,
        timestamp: services.aiProvider.lastCheck,
      };
      if (services.aiProvider.error !== undefined) {
        aiService.error = services.aiProvider.error;
      }
      allServices.push(aiService);
    }

    if (services.rag && services.rag.status !== 'disabled') {
      const ragService = {
        name: 'RAG',
        status: mapServiceStatus(services.rag.status),
        latency: services.rag.responseTime || 0,
        timestamp: services.rag.lastCheck,
        details: {
          pgvector: services.rag.pgvector,
          embeddingsTable: services.rag.embeddingsTable,
          prewarm: services.rag.prewarm,
          indexes: services.rag.indexes,
          embeddingCount: services.rag.embeddingCount,
          staleCount: services.rag.staleCount,
          provider: services.rag.provider,
          model: services.rag.model,
        },
      };
      if (services.rag.error !== undefined) {
        ragService.error = services.rag.error;
      }
      allServices.push(ragService);
    }

    if (services.queueWorker) {
      const queueWorkerService = {
        name: services.queueWorker.name,
        status: services.queueWorker.status,
        latency: services.queueWorker.latency || 0,
        timestamp: services.queueWorker.timestamp,
      };
      if (services.queueWorker.error !== undefined) {
        queueWorkerService.error = services.queueWorker.error;
      }
      allServices.push(queueWorkerService);
    }

    const healthyCount = allServices.filter((service) => service.status === 'healthy').length;
    const totalCount = allServices.length;
    const overallStatus = healthyCount === totalCount ? 'healthy' : 'degraded';

    return sendData(res, {
      overall: overallStatus,
      services: allServices,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount,
      },
      timestamp: services.timestamp,
    });
  }));

  router.post('/health/refresh', asyncHandler(async (_req, res) => {
    const health = await healthCheckService.runAllHealthChecks();
    return sendSuccess(res, { health });
  }));

  router.get('/heartbeat', (_req, res) => {
    sendData(res, { active: healthCheckService.isHeartbeatRunning() });
  });

  router.post('/heartbeat/start', (req, res) => {
    const intervalMinutes = Number.parseInt(req.body.intervalMinutes, 10) || 15;
    healthCheckService.startHeartbeat(intervalMinutes * 60 * 1000);
    sendSuccess(res, { intervalMinutes });
  });

  router.post('/heartbeat/stop', (_req, res) => {
    healthCheckService.stopHeartbeat();
    sendSuccess(res);
  });
}
