/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  CLASSIFICATION_ID_TEXT_EXPR,
  CORRELATION_ID_EXPR,
  ERROR_STAGE_EXPR,
  REASON_CODE_EXPR,
  SQL_STATE_EXPR,
  buildLogsWhereClause,
  createLogsLimiter,
} from './logsRouteHelpers.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import { NotFoundError } from '../utils/appError.mjs';

export function createLogsRouter({
  express,
  rateLimit,
  db,
  authenticateToken,
  requireAdmin,
  logger,
}) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('Logs routes require administrator authorization.');
  }

  const router = express.Router();
  const logsLimiter = createLogsLimiter(rateLimit);

  router.use(authenticateToken);
  router.use(requireAdmin);
  router.use(logsLimiter);

  router.get('/', asyncHandler(async (req, res) => {
    const page = parseIntParam(req.query.page, 1, 1);
    const limit = parseIntParam(req.query.limit, 50, 1, 100);
    const offset = (page - 1) * limit;
    const { whereClause, queryParams, nextParamIndex } = buildLogsWhereClause(req.query);

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM error_log ${whereClause}`,
      queryParams,
    );
    const total = Number.parseInt(countResult.rows[0].total, 10);

    const logsResult = await db.query(
      `SELECT
         id,
         error_id,
         level,
         module,
         message,
         resolved,
         created_at,
         CASE
           WHEN (${CLASSIFICATION_ID_TEXT_EXPR}) ~ '^[0-9]+$' THEN (${CLASSIFICATION_ID_TEXT_EXPR})::int
           ELSE NULL
         END AS classification_id,
         ${ERROR_STAGE_EXPR} AS error_stage,
         ${REASON_CODE_EXPR} AS reason_code,
         ${CORRELATION_ID_EXPR} AS correlation_id,
         ${SQL_STATE_EXPR} AS sql_state,
         (to_jsonb(error_log)->>'rag_operation') AS rag_operation,
         CASE
           WHEN LOWER(COALESCE((to_jsonb(error_log)->>'recoverable'), '')) IN ('true', 'false')
             THEN ((to_jsonb(error_log)->>'recoverable'))::boolean
           ELSE NULL
         END AS recoverable,
         metadata->>'actor' AS actor,
         metadata->>'result' AS result,
         metadata->>'route' AS route
       FROM error_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
      [...queryParams, limit, offset],
    );

    res.json({
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }));

  router.get('/error/:errorId', asyncHandler(async (req, res) => {
    const result = await db.query(
      'SELECT * FROM error_log WHERE error_id = $1',
      [req.params.errorId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Error log not found');
    }

    res.json(result.rows[0]);
  }));

  router.get('/error/:errorId/report', asyncHandler(async (req, res) => {
    const result = await db.query(
      'SELECT * FROM error_log WHERE error_id = $1',
      [req.params.errorId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Error log not found');
    }

    const log = result.rows[0];

    let report = `## Bug Report\n\n`;
    report += `**Error ID:** \`${log.error_id}\`\n`;
    const timestamp = log.created_at instanceof Date
      ? log.created_at.toISOString()
      : new Date(log.created_at).toISOString();
    report += `**Timestamp:** ${timestamp}\n`;
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
  }));

  router.get('/export', asyncHandler(async (req, res) => {
    const maxExportLimit = Number.parseInt(process.env.MAX_LOG_EXPORT_LIMIT, 10) || 5000;
    const { whereClause, queryParams, nextParamIndex } = buildLogsWhereClause(req.query, {
      includeDateRange: true,
    });

    const result = await db.query(
      `SELECT * FROM error_log ${whereClause} ORDER BY created_at DESC LIMIT $${nextParamIndex}`,
      [...queryParams, maxExportLimit],
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="logs-export-${Date.now()}.json"`);
    res.json(result.rows);
  }));

  router.get('/stats', asyncHandler(async (req, res) => {
    const totalsResult = await db.query(
      `SELECT 
        COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE level = 'ERROR') as total_errors,
        COUNT(*) FILTER (WHERE level = 'WARN') as total_warnings,
        COUNT(*) FILTER (WHERE level = 'INFO') as total_info,
        COUNT(*) FILTER (WHERE level = 'DEBUG') as total_debug,
        COUNT(*) FILTER (WHERE resolved = true) as total_resolved,
        COUNT(*) FILTER (WHERE resolved = false) as unresolved_logs,
        COUNT(*) FILTER (WHERE resolved = false AND level = 'ERROR') as unresolved_errors
       FROM error_log`,
    );

    const moduleResult = await db.query(
      `SELECT module, COUNT(*) as count
       FROM error_log
       GROUP BY module
       ORDER BY count DESC
       LIMIT 10`,
    );

    const trendsResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS logs_24h,
        COUNT(*) FILTER (WHERE level = 'ERROR' AND created_at >= NOW() - INTERVAL '24 hours') AS errors_24h,
        COUNT(*) FILTER (WHERE level = 'WARN'  AND created_at >= NOW() - INTERVAL '24 hours') AS warnings_24h,
        COUNT(*) FILTER (WHERE level = 'INFO'  AND created_at >= NOW() - INTERVAL '24 hours') AS info_24h,
        COUNT(*) FILTER (WHERE level = 'DEBUG' AND created_at >= NOW() - INTERVAL '24 hours') AS debug_24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS logs_7d,
        COUNT(*) FILTER (WHERE level = 'ERROR' AND created_at >= NOW() - INTERVAL '7 days') AS errors_7d,
        COUNT(*) FILTER (WHERE level = 'WARN'  AND created_at >= NOW() - INTERVAL '7 days') AS warnings_7d,
        COUNT(*) FILTER (WHERE level = 'INFO'  AND created_at >= NOW() - INTERVAL '7 days') AS info_7d,
        COUNT(*) FILTER (WHERE level = 'DEBUG' AND created_at >= NOW() - INTERVAL '7 days') AS debug_7d
       FROM error_log
       WHERE created_at >= NOW() - INTERVAL '7 days'`,
    );

    const trends = trendsResult.rows[0];
    res.json({
      totals: totalsResult.rows[0],
      topModules: moduleResult.rows,
      trends: {
        last24h: {
          logs_24h: trends.logs_24h,
          errors_24h: trends.errors_24h,
          warnings_24h: trends.warnings_24h,
          info_24h: trends.info_24h,
          debug_24h: trends.debug_24h,
        },
        last7d: {
          logs_7d: trends.logs_7d,
          errors_7d: trends.errors_7d,
          warnings_7d: trends.warnings_7d,
          info_7d: trends.info_7d,
          debug_7d: trends.debug_7d,
        },
      },
    });
  }));

  router.post('/error/:errorId/resolve', asyncHandler(async (req, res) => {
    const { notes } = req.body;

    const result = await db.query(
      `UPDATE error_log 
       SET resolved = true, resolved_at = NOW(), resolution_notes = $1
       WHERE error_id = $2
       RETURNING *`,
      [notes || null, req.params.errorId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Error log not found');
    }

    logger.info('Error marked as resolved', { errorId: req.params.errorId });
    res.json(result.rows[0]);
  }));

  router.post('/cleanup', asyncHandler(async (req, res) => {
    const settingsResult = await db.query(
      `SELECT key, value FROM settings WHERE key IN ('log_retention_days', 'error_log_retention_days', 'rag_log_retention_days')`,
    );

    const settings = {};
    settingsResult.rows.forEach((row) => {
      settings[row.key] = Number.parseInt(row.value, 10);
    });

    const errorRetentionDays = settings.error_log_retention_days || 90;
    const appLogRetentionDays = settings.log_retention_days || 30;
    const ragLogRetentionDays = settings.rag_log_retention_days || 30;

    const errorLogResult = await db.query(
      `DELETE FROM error_log 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [errorRetentionDays],
    );

    const appLogResult = await db.query(
      `DELETE FROM app_log 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [appLogRetentionDays],
    );

    const ragLogResult = await db.query(
      `DELETE FROM rag_logs
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       RETURNING id`,
      [ragLogRetentionDays],
    );

    logger.info('Log cleanup completed', {
      errorLogsDeleted: errorLogResult.rows.length,
      appLogsDeleted: appLogResult.rows.length,
      ragLogsDeleted: ragLogResult.rows.length,
    });

    res.json({
      success: true,
      deleted: {
        errorLogs: errorLogResult.rows.length,
        appLogs: appLogResult.rows.length,
        ragLogs: ragLogResult.rows.length,
      },
    });
  }));

  router.delete('/', asyncHandler(async (req, res) => {
    const errorLogResult = await db.query('DELETE FROM error_log');
    const appLogResult = await db.query('DELETE FROM app_log');
    const ragLogResult = await db.query('DELETE FROM rag_logs');

    logger.info('All logs cleared', {
      errorLogsDeleted: errorLogResult.rowCount,
      appLogsDeleted: appLogResult.rowCount,
      ragLogsDeleted: ragLogResult.rowCount,
    });

    res.json({
      success: true,
      deleted: {
        errorLogs: errorLogResult.rowCount,
        appLogs: appLogResult.rowCount,
        ragLogs: ragLogResult.rowCount,
      },
    });
  }));

  return router;
}
