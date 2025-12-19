const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const logger = createLogger('LogsAPI');

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Get application logs with filtering
 */
router.get('/', async (req, res) => {
  try {
    const { 
      level, 
      module, 
      from, 
      to, 
      limit = 100, 
      offset = 0,
      type = 'all'  // 'all', 'error', 'app'
    } = req.query;

    // Simplified query for now
    const result = await db.query(
      `SELECT * FROM error_log 
       WHERE ($1::text IS NULL OR level = $1)
       AND ($2::text IS NULL OR module ILIKE '%' || $2 || '%')
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [level || null, module || null, parseInt(limit), parseInt(offset)]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM error_log 
       WHERE ($1::text IS NULL OR level = $1)
       AND ($2::text IS NULL OR module ILIKE '%' || $2 || '%')`,
      [level || null, module || null]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Failed to fetch logs', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/logs/error/{errorId}:
 *   get:
 *     summary: Get single error by error_id (UUID)
 */
router.get('/error/:errorId', async (req, res) => {
  try {
    const { errorId } = req.params;
    
    const result = await db.query(
      'SELECT * FROM error_log WHERE error_id = $1',
      [errorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/logs/error/{errorId}/report:
 *   get:
 *     summary: Generate markdown bug report for GitHub issue
 */
router.get('/error/:errorId/report', async (req, res) => {
  try {
    const { errorId } = req.params;
    
    const result = await db.query(
      'SELECT * FROM error_log WHERE error_id = $1',
      [errorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error not found' });
    }

    const error = result.rows[0];
    const report = generateBugReport(error);

    if (req.query.format === 'json') {
      res.json({ report, error });
    } else {
      res.type('text/markdown').send(report);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/logs/export:
 *   get:
 *     summary: Export logs as JSON for analysis
 */
router.get('/export', async (req, res) => {
  try {
    const { from, to, level, limit = 1000 } = req.query;
    
    const result = await db.query(
      `SELECT * FROM error_log 
       WHERE ($1::timestamp IS NULL OR created_at >= $1)
       AND ($2::timestamp IS NULL OR created_at <= $2)
       AND ($3::text IS NULL OR level = $3)
       ORDER BY created_at DESC 
       LIMIT $4`,
      [from || null, to || null, level || null, parseInt(limit)]
    );

    const exportData = {
      exportedAt: new Date().toISOString(),
      appVersion: process.env.npm_package_version || '1.0.0',
      totalErrors: result.rows.length,
      filters: { from, to, level, limit },
      errors: result.rows
    };

    res.setHeader('Content-Disposition', `attachment; filename=classifarr-logs-${Date.now()}.json`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/logs/stats:
 *   get:
 *     summary: Get error statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_errors,
        COUNT(*) FILTER (WHERE level = 'ERROR') as error_count,
        COUNT(*) FILTER (WHERE level = 'WARN') as warn_count,
        COUNT(*) FILTER (WHERE resolved = true) as resolved_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d
      FROM error_log
    `);

    const byModule = await db.query(`
      SELECT module, COUNT(*) as count
      FROM error_log
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY module
      ORDER BY count DESC
      LIMIT 10
    `);

    const recent = await db.query(`
      SELECT error_id, module, message, created_at
      FROM error_log
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      summary: stats.rows[0],
      byModule: byModule.rows,
      recentErrors: recent.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/logs/error/{errorId}/resolve:
 *   post:
 *     summary: Mark error as resolved
 */
router.post('/error/:errorId/resolve', async (req, res) => {
  try {
    const { errorId } = req.params;
    const { notes } = req.body;
    
    await db.query(
      `UPDATE error_log 
       SET resolved = true, resolved_at = NOW(), resolution_notes = $2
       WHERE error_id = $1`,
      [errorId, notes]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/logs/cleanup:
 *   post:
 *     summary: Clean up old logs based on retention settings
 */
router.post('/cleanup', async (req, res) => {
  try {
    const retentionResult = await db.query(
      "SELECT value FROM settings WHERE key = 'error_log_retention_days'"
    );
    const retentionDays = parseInt(retentionResult.rows[0]?.value || '90');

    const deleteResult = await db.query(
      `DELETE FROM error_log 
       WHERE created_at < NOW() - INTERVAL '1 day' * $1
       AND resolved = true
       RETURNING id`,
      [retentionDays]
    );

    const appLogResult = await db.query(
      `DELETE FROM app_log 
       WHERE created_at < NOW() - INTERVAL '30 days'
       RETURNING id`
    );

    res.json({
      success: true,
      deletedErrors: deleteResult.rowCount,
      deletedAppLogs: appLogResult.rowCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate bug report
function generateBugReport(error) {
  const systemCtx = error.system_context || {};
  const requestCtx = error.request_context || {};
  const metadata = error.metadata || {};

  return `## 🐛 Bug Report: ${error.error_id}

**Generated:** ${new Date().toISOString()}
**Error Time:** ${error.created_at}
**Module:** \`${error.module}\`
**Level:** ${error.level}

### Error Message
\`\`\`
${error.message}
\`\`\`

${error.stack_trace ? `### Stack Trace
\`\`\`
${error.stack_trace}
\`\`\`` : ''}

### Request Context
${requestCtx.url ? `- **URL:** \`${requestCtx.method} ${requestCtx.url}\`` : ''}
${requestCtx.ip ? `- **IP:** ${requestCtx.ip}` : ''}
${requestCtx.userAgent ? `- **User Agent:** ${requestCtx.userAgent}` : ''}
${requestCtx.params && Object.keys(requestCtx.params).length > 0 ? `- **Params:** \`${JSON.stringify(requestCtx.params)}\`` : ''}

### System Information
- **App Version:** ${systemCtx.appVersion || 'Unknown'}
- **Node Version:** ${systemCtx.nodeVersion || 'Unknown'}
- **Platform:** ${systemCtx.platform || 'Unknown'} (${systemCtx.arch || 'Unknown'})
- **Uptime:** ${systemCtx.uptime ? Math.floor(systemCtx.uptime / 3600) + ' hours' : 'Unknown'}
${systemCtx.memoryUsage ? `- **Memory:** ${Math.round(systemCtx.memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(systemCtx.memoryUsage.heapTotal / 1024 / 1024)}MB` : ''}

${Object.keys(metadata).length > 0 ? `### Additional Context
\`\`\`json
${JSON.stringify(metadata, null, 2)}
\`\`\`` : ''}

---
*This report was auto-generated by Classifarr. Error ID: \`${error.error_id}\`*
`;
}

module.exports = router;
