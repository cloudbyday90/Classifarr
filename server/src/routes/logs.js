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
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('LogsAPI');

// Rate limiter for logs API - 100 requests per 15 minutes
const logsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many log requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication and rate limiting
router.use(authenticateToken);
router.use(logsLimiter);

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Get paginated logs with filters
 *     tags: [Logs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page (default 50)
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *         description: Filter by log level
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *         description: Filter by module name
 *       - in: query
 *         name: resolved
 *         schema:
 *           type: boolean
 *         description: Filter by resolved status
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 100);
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;
    
    if (req.query.level) {
      whereConditions.push(`level = $${paramCount++}`);
      queryParams.push(req.query.level.toUpperCase());
    }
    
    if (req.query.module) {
      whereConditions.push(`module = $${paramCount++}`);
      queryParams.push(req.query.module);
    }
    
    if (req.query.resolved !== undefined) {
      whereConditions.push(`resolved = $${paramCount++}`);
      queryParams.push(req.query.resolved === 'true');
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM error_log ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    const logsResult = await db.query(
      `SELECT id, error_id, level, module, message, resolved, created_at
       FROM error_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      [...queryParams, limit, offset]
    );
    
    res.json({
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/logs/error/{errorId}:
 *   get:
 *     summary: Get single error details
 *     tags: [Logs]
 */
router.get('/error/:errorId', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM error_log WHERE error_id = $1`,
      [req.params.errorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error log not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/logs/error/{errorId}/report:
 *   get:
 *     summary: Generate markdown bug report for GitHub
 *     tags: [Logs]
 */
router.get('/error/:errorId/report', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT * FROM error_log WHERE error_id = $1`,
      [req.params.errorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error log not found' });
    }
    
    const log = result.rows[0];
    
    // Generate markdown bug report
    let report = `## Bug Report\n\n`;
    report += `**Error ID:** \`${log.error_id}\`\n`;
    report += `**Timestamp:** ${log.created_at}\n`;
    report += `**Level:** ${log.level}\n`;
    report += `**Module:** ${log.module}\n\n`;
    report += `### Description\n\n${log.message}\n\n`;
    
    if (log.stack_trace) {
      report += `### Stack Trace\n\n\`\`\`\n${log.stack_trace}\n\`\`\`\n\n`;
    }
    
    if (log.request_context) {
      report += `### Request Context\n\n\`\`\`json\n${JSON.stringify(log.request_context, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (log.system_context) {
      report += `### System Context\n\n\`\`\`json\n${JSON.stringify(log.system_context, null, 2)}\n\`\`\`\n\n`;
    }
    
    if (log.metadata) {
      report += `### Additional Data\n\n\`\`\`json\n${JSON.stringify(log.metadata, null, 2)}\n\`\`\`\n\n`;
    }
    
    res.json({ report });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/logs/export:
 *   get:
 *     summary: Export logs as JSON
 *     tags: [Logs]
 */
router.get('/export', async (req, res, next) => {
  try {
    // Configurable maximum export limit to prevent memory issues
    const MAX_EXPORT_LIMIT = parseInt(process.env.MAX_LOG_EXPORT_LIMIT) || 5000;
    
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;
    
    if (req.query.level) {
      whereConditions.push(`level = $${paramCount++}`);
      queryParams.push(req.query.level.toUpperCase());
    }
    
    if (req.query.module) {
      whereConditions.push(`module = $${paramCount++}`);
      queryParams.push(req.query.module);
    }
    
    if (req.query.startDate) {
      whereConditions.push(`created_at >= $${paramCount++}`);
      queryParams.push(req.query.startDate);
    }
    
    if (req.query.endDate) {
      whereConditions.push(`created_at <= $${paramCount++}`);
      queryParams.push(req.query.endDate);
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    const result = await db.query(
      `SELECT * FROM error_log ${whereClause} ORDER BY created_at DESC LIMIT $${paramCount++}`,
      [...queryParams, MAX_EXPORT_LIMIT]
    );
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="logs-export-${Date.now()}.json"`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/logs/stats:
 *   get:
 *     summary: Get aggregated log statistics
 *     tags: [Logs]
 */
router.get('/stats', async (req, res, next) => {
  try {
    // Total errors and warnings
    const totalsResult = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE level = 'ERROR') as total_errors,
        COUNT(*) FILTER (WHERE level = 'WARN') as total_warnings,
        COUNT(*) FILTER (WHERE resolved = true) as total_resolved,
        COUNT(*) FILTER (WHERE resolved = false AND level = 'ERROR') as unresolved_errors
       FROM error_log`
    );
    
    // Errors by module
    const moduleResult = await db.query(
      `SELECT module, COUNT(*) as count
       FROM error_log
       WHERE level = 'ERROR'
       GROUP BY module
       ORDER BY count DESC
       LIMIT 10`
    );
    
    // Recent 24h trend
    const last24hResult = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE level = 'ERROR') as errors_24h,
        COUNT(*) FILTER (WHERE level = 'WARN') as warnings_24h
       FROM error_log
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    
    // Recent 7d trend
    const last7dResult = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE level = 'ERROR') as errors_7d,
        COUNT(*) FILTER (WHERE level = 'WARN') as warnings_7d
       FROM error_log
       WHERE created_at >= NOW() - INTERVAL '7 days'`
    );
    
    res.json({
      totals: totalsResult.rows[0],
      topModules: moduleResult.rows,
      trends: {
        last24h: last24hResult.rows[0],
        last7d: last7dResult.rows[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/logs/error/{errorId}/resolve:
 *   post:
 *     summary: Mark error as resolved
 *     tags: [Logs]
 */
router.post('/error/:errorId/resolve', async (req, res, next) => {
  try {
    const { notes } = req.body;
    
    const result = await db.query(
      `UPDATE error_log 
       SET resolved = true, resolved_at = NOW(), resolution_notes = $1
       WHERE error_id = $2
       RETURNING *`,
      [notes || null, req.params.errorId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error log not found' });
    }
    
    logger.info('Error marked as resolved', { errorId: req.params.errorId });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/logs/cleanup:
 *   post:
 *     summary: Clean up old logs based on retention settings
 *     tags: [Logs]
 */
router.post('/cleanup', async (req, res, next) => {
  try {
    // Get retention settings
    const settingsResult = await db.query(
      `SELECT key, value FROM settings WHERE key IN ('log_retention_days', 'error_log_retention_days')`
    );
    
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = parseInt(row.value);
    });
    
    const errorRetentionDays = settings.error_log_retention_days || 90;
    const appLogRetentionDays = settings.log_retention_days || 30;
    
    // Clean up old error logs
    const errorLogResult = await db.query(
      `DELETE FROM error_log 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [errorRetentionDays]
    );
    
    // Clean up old app logs
    const appLogResult = await db.query(
      `DELETE FROM app_log 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [appLogRetentionDays]
    );
    
    logger.info('Log cleanup completed', {
      errorLogsDeleted: errorLogResult.rows.length,
      appLogsDeleted: appLogResult.rows.length
    });
    
    res.json({
      success: true,
      deleted: {
        errorLogs: errorLogResult.rows.length,
        appLogs: appLogResult.rows.length
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
