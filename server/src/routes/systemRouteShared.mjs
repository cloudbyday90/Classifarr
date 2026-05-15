/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

export function mapServiceStatus(status) {
  switch (status) {
    case 'connected':
    case 'configured':
      return 'healthy';
    case 'partial':
    case 'degraded':
    case 'circuit_open':
      return 'degraded';
    case 'error':
    case 'disconnected':
    case 'not configured':
    case 'not_configured':
      return 'unhealthy';
    default:
      return 'unknown';
  }
}

export function createSystemRouter({
  express,
  db,
  healthCheckService,
  authenticateToken,
  appVersion,
  fsPromises,
  pathModule,
}) {
  const router = express.Router();

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

  router.use(authenticateToken);

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

  router.get('/status', asyncHandler(async (_req, res) => {
    const uptime = healthCheckService.getUptime();
    let pgvector = null;

    try {
      const settingsResult = await db.query(
        `SELECT key, value FROM settings WHERE key IN (
          'avx_guard_pgvector_selected',
          'avx_guard_pgvector_build',
          'avx_guard_cpu_avx',
          'avx_guard_cpu_avx2',
          'avx_guard_last_run'
        )`,
      );

      const entries = {};
      for (const row of settingsResult.rows) {
        entries[row.key] = row.value;
      }

      pgvector = {
        build: entries.avx_guard_pgvector_build || null,
        selectedVariant: entries.avx_guard_pgvector_selected || null,
        cpuAvx: entries.avx_guard_cpu_avx || null,
        cpuAvx2: entries.avx_guard_cpu_avx2 || null,
        lastChecked: entries.avx_guard_last_run || null,
      };
    } catch (_e) { /* pgvector remains null */ }

    return sendData(res, {
      version: appVersion,
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      pgvector,
      timestamp: new Date().toISOString(),
    });
  }));

  router.get('/logs', asyncHandler(async (req, res) => {
    const limit = Number.parseInt(req.query.limit, 10) || 100;

    const result = await db.query(
      `SELECT 
        ch.id,
        ch.title,
        ch.media_type,
        l.name as selected_library,
        ch.confidence as confidence_score,
        ch.created_at,
        ch.metadata as details
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      ORDER BY ch.created_at DESC
      LIMIT $1`,
      [limit],
    );

    const logs = result.rows.map((row) => ({
      id: row.id,
      timestamp: row.created_at,
      type: 'classification',
      message: `${row.media_type}: ${row.title} → ${row.selected_library || 'Unassigned'} (confidence: ${row.confidence_score}%)`,
      details: row.details,
    }));

    return sendData(res, { logs, total: logs.length });
  }));

  router.get('/browse-folders', asyncHandler(async (req, res) => {
    const browsePath = req.query.path || '/';
    const normalizedPath = pathModule.normalize(browsePath);
    if (normalizedPath.includes('..')) {
      return sendError(res, 'Invalid path');
    }

    const stats = await fsPromises.stat(normalizedPath);
    if (!stats.isDirectory()) {
      return sendError(res, 'Path is not a directory');
    }

    const entries = await fsPromises.readdir(normalizedPath, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        path: pathModule.join(normalizedPath, entry.name),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return sendData(res, {
      currentPath: normalizedPath,
      parentPath: pathModule.dirname(normalizedPath),
      folders,
    });
  }));

  return router;
}
