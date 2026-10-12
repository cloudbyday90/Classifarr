import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';
import { normalizeServiceHealthStatus, summarizeServiceHealth } from '../services/serviceHealthSummary.mjs';
import { describeHealthObservation, projectHealthDetails } from '../services/healthObservationFreshness.mjs';

export function mapServiceStatus(status) {
  return normalizeServiceHealthStatus(status);
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
    const freshnessPolicy = healthCheckService.getHealthFreshnessPolicy();

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
      freshnessPolicy,
      details: projectHealthDetails({
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
      }, freshnessPolicy),
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

    // Failed membership reads must remain visible even when no instances can be listed.
    for (const [key, name] of [['radarr', 'Radarr'], ['sonarr', 'Sonarr']]) {
      if (services[key]?.failure) {
        allServices.push({ name, status: 'unknown', latency: null, timestamp: services[key].lastCheck,
          error: services[key].error, failure: services[key].failure });
      }
    }

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
        failure: services.mediaServer.failure,
      };
      if (services.mediaServer.error !== undefined) {
        mediaService.error = services.mediaServer.error;
      }
      allServices.push(mediaService);
    }

    if (services.radarr && !services.radarr.failure && services.radarr.instances && services.radarr.instances.length > 0) {
      services.radarr.instances.forEach((instance) => {
        const radarrService = {
          name: `Radarr (${instance.name})`,
          status: mapServiceStatus(instance.status),
          latency: instance.responseTime || 0,
          timestamp: instance.lastCheck,
        };
        if (instance.error !== undefined) {
          radarrService.error = instance.error;
        }
        allServices.push(radarrService);
      });
    }

    if (services.sonarr && !services.sonarr.failure && services.sonarr.instances && services.sonarr.instances.length > 0) {
      services.sonarr.instances.forEach((instance) => {
        const sonarrService = {
          name: `Sonarr (${instance.name})`,
          status: mapServiceStatus(instance.status),
          latency: instance.responseTime || 0,
          timestamp: instance.lastCheck,
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
        failure: services.aiProvider.failure,
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
        failure: services.rag.failure,
        details: services.rag.failure ? null : {
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
        status: mapServiceStatus(services.queueWorker.status),
        latency: services.queueWorker.latency || 0,
        timestamp: services.queueWorker.timestamp,
      };
      if (services.queueWorker.error !== undefined) {
        queueWorkerService.error = services.queueWorker.error;
      }
      allServices.push(queueWorkerService);
    }

    const freshnessPolicy = healthCheckService.getHealthFreshnessPolicy();
    const observations = allServices.map(service => {
      const observation = describeHealthObservation(service, freshnessPolicy);
      return { ...service, ...observation, status: observation.effectiveStatus };
    });
    const aggregate = summarizeServiceHealth(observations);

    return sendData(res, {
      overall: aggregate.overall,
      services: observations,
      freshnessPolicy,
      summary: aggregate.summary,
      timestamp: services.timestamp,
    });
  }));

  router.post('/health/refresh', asyncHandler(async (_req, res) => {
    const health = await healthCheckService.runAllHealthChecks();
    return sendSuccess(res, { health });
  }));

  router.get('/heartbeat', (_req, res) => {
    sendData(res, { active: healthCheckService.isHeartbeatRunning(), freshnessPolicy: healthCheckService.getHealthFreshnessPolicy() });
  });

  router.post('/heartbeat/start', (req, res) => {
    const intervalMinutes = req.body?.intervalMinutes === undefined ? 15 : req.body.intervalMinutes;
    if (!Number.isSafeInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
      return sendError(res, 'intervalMinutes must be a whole number between 1 and 1440', 400);
    }
    healthCheckService.startHeartbeat(intervalMinutes * 60 * 1000);
    sendSuccess(res, { intervalMinutes });
  });

  router.post('/heartbeat/stop', (_req, res) => {
    healthCheckService.stopHeartbeat();
    sendSuccess(res);
  });
}
