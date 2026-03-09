/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const express = require('express');
const db = require('../config/database');
const discordBot = require('../services/discordBot');
const healthCheckService = require('../services/healthCheckService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Cache package version at module load time
const packageJson = require('../../package.json');
const APP_VERSION = packageJson.version;

/**
 * Helper function to map service status to health status
 */
function mapServiceStatus(status) {
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

// Health check endpoints (no authentication for Kubernetes/Docker probes)
// These must be defined BEFORE the authenticateToken middleware

/**
 * @swagger
 * /api/system/health/live:
 *   get:
 *     summary: Liveness probe for Kubernetes/Docker
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Application is alive
 */
router.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/system/health/ready:
 *   get:
 *     summary: Readiness probe for Kubernetes/Docker
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Application is ready to serve traffic
 *       503:
 *         description: Application is not ready
 */
router.get('/health/ready', async (req, res) => {
  try {
    const dbHealth = await healthCheckService.checkDatabase();
    const isReady = dbHealth.status === 'connected';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not_ready',
      database: dbHealth.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/system/health/memory:
 *   get:
 *     summary: Node.js heap and host OS memory pressure probe
 *     description: >
 *       Lightweight no-auth endpoint reporting Node.js heap usage and host
 *       OS RAM. Returns HTTP 200 when status is "ok" or "warning", HTTP 503
 *       when status is "critical" (heap ≥ 90% of cap or OS RAM ≥ 95% used).
 *       Suitable for Uptime Kuma, Prometheus scraping, or any monitoring tool.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Memory pressure is ok or warning
 *       503:
 *         description: Memory pressure is critical
 */
router.get('/health/memory', (req, res) => {
  const memory = healthCheckService.checkProcessMemory();
  res.status(memory.status === 'critical' ? 503 : 200).json(memory);
});

// Apply authentication to remaining routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Get enhanced health status with overall system health
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: "Force refresh health checks (default: use cache)"
 *     responses:
 *       200:
 *         description: System is healthy
 *       503:
 *         description: System is unhealthy
 */
router.get('/health', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    let health;
    if (forceRefresh) {
      // Run fresh health checks
      health = await healthCheckService.runAllHealthChecks();
    } else {
      // Use cached results
      health = healthCheckService.getHealthCache();

      // If cache is empty (first load), run checks
      if (!health.database.lastCheck) {
        health = await healthCheckService.runAllHealthChecks();
      }
    }

    // Get Queue Worker status
    const queueWorker = await healthCheckService.checkQueueWorker();

    const dbHealth = health.database;
    const isHealthy = dbHealth.status === 'connected';
    const uptime = healthCheckService.getUptime();

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      version: APP_VERSION,
      uptime: uptime,
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
        queueWorker: queueWorker
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/system/health/services:
 *   get:
 *     summary: Get detailed health status of all services
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Detailed service health breakdown
 */
router.get('/health/services', async (req, res) => {
  try {
    const services = await healthCheckService.getAllServicesHealth();
    
    // Flatten the structure for easier consumption
    const allServices = [];

    // Add database
    if (services.database && services.database.status !== 'not configured') {
      const dbService = {
        name: 'PostgreSQL',
        status: mapServiceStatus(services.database.status),
        latency: services.database.responseTime || 0,
        timestamp: services.database.lastCheck
      };
      if (services.database.error !== undefined) {
        dbService.error = services.database.error;
      }
      allServices.push(dbService);
    }

    // Add media server
    if (services.mediaServer && services.mediaServer.status !== 'not configured') {
      const mediaService = {
        name: services.mediaServer.type || 'Media Server',
        status: mapServiceStatus(services.mediaServer.status),
        latency: services.mediaServer.responseTime || 0,
        timestamp: services.mediaServer.lastCheck
      };
      if (services.mediaServer.error !== undefined) {
        mediaService.error = services.mediaServer.error;
      }
      allServices.push(mediaService);
    }

    // Add Radarr instances
    if (services.radarr && services.radarr.instances && services.radarr.instances.length > 0) {
      services.radarr.instances.forEach(instance => {
        const radarrService = {
          name: `Radarr (${instance.name})`,
          status: mapServiceStatus(instance.status),
          latency: instance.responseTime || 0,
          timestamp: services.radarr.lastCheck
        };
        if (instance.error !== undefined) {
          radarrService.error = instance.error;
        }
        allServices.push(radarrService);
      });
    }

    // Add Sonarr instances
    if (services.sonarr && services.sonarr.instances && services.sonarr.instances.length > 0) {
      services.sonarr.instances.forEach(instance => {
        const sonarrService = {
          name: `Sonarr (${instance.name})`,
          status: mapServiceStatus(instance.status),
          latency: instance.responseTime || 0,
          timestamp: services.sonarr.lastCheck
        };
        if (instance.error !== undefined) {
          sonarrService.error = instance.error;
        }
        allServices.push(sonarrService);
      });
    }

    // Add AI Provider
    if (services.aiProvider && services.aiProvider.status !== 'not configured') {
      const aiService = {
        name: services.aiProvider.provider || 'AI Provider',
        status: mapServiceStatus(services.aiProvider.status),
        latency: services.aiProvider.responseTime || 0,
        timestamp: services.aiProvider.lastCheck
      };
      if (services.aiProvider.error !== undefined) {
        aiService.error = services.aiProvider.error;
      }
      allServices.push(aiService);
    }

    // Add Queue Worker
    if (services.queueWorker) {
      const queueWorkerService = {
        name: services.queueWorker.name,
        status: services.queueWorker.status,
        latency: services.queueWorker.latency || 0,
        timestamp: services.queueWorker.timestamp
      };
      if (services.queueWorker.error !== undefined) {
        queueWorkerService.error = services.queueWorker.error;
      }
      allServices.push(queueWorkerService);
    }

    const healthyCount = allServices.filter(s => s.status === 'healthy').length;
    const totalCount = allServices.length;

    // Calculate overall status
    const overallStatus = healthyCount === totalCount ? 'healthy' : 'degraded';

    res.json({
      overall: overallStatus,
      services: allServices,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount
      },
      timestamp: services.timestamp
    });
  } catch (error) {
    console.error('Service health check error:', error);
    res.status(500).json({
      error: 'Failed to check service health',
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/system/health/refresh:
 *   post:
 *     summary: Force refresh all health checks
 *     tags: [System]
 */
router.post('/health/refresh', async (req, res) => {
  try {
    const health = await healthCheckService.runAllHealthChecks();
    res.json({ success: true, health });
  } catch (error) {
    console.error('Health refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh health checks' });
  }
});

/**
 * @swagger
 * /api/system/heartbeat:
 *   get:
 *     summary: Get heartbeat scheduler status
 *     tags: [System]
 */
router.get('/heartbeat', (req, res) => {
  res.json({
    active: healthCheckService.isHeartbeatRunning()
  });
});

/**
 * @swagger
 * /api/system/heartbeat/start:
 *   post:
 *     summary: Start heartbeat scheduler
 *     tags: [System]
 */
router.post('/heartbeat/start', (req, res) => {
  const intervalMinutes = parseInt(req.body.intervalMinutes) || 15;
  healthCheckService.startHeartbeat(intervalMinutes * 60 * 1000);
  res.json({ success: true, intervalMinutes });
});

/**
 * @swagger
 * /api/system/heartbeat/stop:
 *   post:
 *     summary: Stop heartbeat scheduler
 *     tags: [System]
 */
router.post('/heartbeat/stop', (req, res) => {
  healthCheckService.stopHeartbeat();
  res.json({ success: true });
});

/**
 * @swagger
 * /api/system/status:
 *   get:
 *     summary: Get system information
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System information
 */
router.get('/status', async (req, res) => {
  try {
    const uptime = healthCheckService.getUptime();
    const version = packageJson.version;
    let pgvector = null;

    try {
      const settingsResult = await db.query(
        `SELECT key, value FROM settings WHERE key IN (
          'avx_guard_pgvector_selected',
          'avx_guard_pgvector_build',
          'avx_guard_cpu_avx',
          'avx_guard_cpu_avx2',
          'avx_guard_last_run'
        )`
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
        lastChecked: entries.avx_guard_last_run || null
      };
    } catch (error) {
      // settings table may not exist yet; omit pgvector info
      pgvector = null;
    }

    res.json({
      version,
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      pgvector,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

/**
 * @swagger
 * /api/system/logs:
 *   get:
 *     summary: Get recent log entries
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of log entries to return (default 100)
 *     responses:
 *       200:
 *         description: Recent log entries
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    // Get recent classification history as a proxy for logs
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
      [limit]
    );

    const logs = result.rows.map(row => ({
      id: row.id,
      timestamp: row.created_at,
      type: 'classification',
      message: `${row.media_type}: ${row.title} → ${row.selected_library || 'Unassigned'} (confidence: ${row.confidence_score}%)`,
      details: row.details
    }));

    res.json({
      logs,
      total: logs.length
    });
  } catch (error) {
    console.error('Logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * @swagger
 * /api/system/browse-folders:
 *   get:
 *     summary: Browse directories in the container filesystem
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: path
 *         schema:
 *           type: string
 *         description: "Path to browse (default: /)"
 *     responses:
 *       200:
 *         description: List of directories at the given path
 */
router.get('/browse-folders', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    const browsePath = req.query.path || '/';

    // Security: Prevent path traversal attacks
    const normalizedPath = path.normalize(browsePath);
    if (normalizedPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Check if path exists and is a directory
    const stats = await fs.stat(normalizedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    // Read directory contents
    const entries = await fs.readdir(normalizedPath, { withFileTypes: true });

    // Filter to directories only and sort
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        name: entry.name,
        path: path.join(normalizedPath, entry.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      currentPath: normalizedPath,
      parentPath: path.dirname(normalizedPath),
      folders
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Path not found' });
    }
    if (error.code === 'EACCES') {
      return res.status(403).json({ error: 'Permission denied' });
    }
    console.error('Browse folders error:', error);
    res.status(500).json({ error: 'Failed to browse folders' });
  }
});

module.exports = router;
