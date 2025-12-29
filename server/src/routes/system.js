/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/system/health:
 *   get:
 *     summary: Get health status of all services
 *     tags: [System]
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: "Force refresh health checks (default: use cache)"
 *     responses:
 *       200:
 *         description: Health status of all services
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

    // Format response for frontend compatibility
    const response = {
      database: health.database.status,
      discordBot: health.discordBot.status,
      ollama: health.ollama.status,
      radarr: health.radarr.status,
      sonarr: health.sonarr.status,
      mediaServer: health.mediaServer.status,
      tmdb: health.tmdb.status,
      tavily: health.tavily.status,
      // Include detailed info
      details: health,
      // Heartbeat status
      heartbeatActive: healthCheckService.isHeartbeatRunning()
    };

    res.json(response);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to check system health' });
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
    const uptime = process.uptime();
    const version = process.env.npm_package_version || '1.0.0';

    res.json({
      version,
      uptime: Math.floor(uptime),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
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
