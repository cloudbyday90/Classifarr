import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';

export function registerSystemInfoRoutes(router, { healthCheckService, db, appVersion, fsPromises, pathModule }) {
  router.get('/status', asyncHandler(async (_req, res) => {
    const uptime = healthCheckService.getUptime();
    let pgvector = null;
    let postgresVersion = null;
    let pgvectorVersion = null;

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

    try {
      const versionResult = await db.query(
        `SELECT version() AS pg_version`,
      );
      if (versionResult.rows[0]) {
        const fullVersion = versionResult.rows[0].pg_version;
        // eslint-disable-next-line security/detect-unsafe-regex -- literal char separators prevent backtracking
        const match = fullVersion.match(/PostgreSQL (\d+\.\d+(?:\.\d+)?)/);
        postgresVersion = match ? match[1] : fullVersion;
      }
    } catch (_e) { /* postgresVersion remains null */ }

    try {
      const extResult = await db.query(
        `SELECT extversion FROM pg_extension WHERE extname = 'vector'`,
      );
      if (extResult.rows[0]) {
        pgvectorVersion = extResult.rows[0].extversion;
      }
    } catch (_e) { /* pgvectorVersion remains null */ }

    return sendData(res, {
      version: appVersion,
      uptime,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      postgresVersion,
      pgvectorVersion,
      pgvector,
      timestamp: new Date().toISOString(),
    });
  }));

  router.get('/logs', asyncHandler(async (req, res) => {
    const limit = parseIntParam(req.query.limit, 100, 1);

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
      throw new ValidationError('Invalid path');
    }

    const stats = await fsPromises.stat(normalizedPath);
    if (!stats.isDirectory()) {
      throw new ValidationError('Path is not a directory');
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
}
