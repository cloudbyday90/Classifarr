import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { getClassificationQueueHealth } from '../services/classificationQueueStatsService.mjs';

function createStatsHelpers(db) {
  async function getOverallStats() {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        ROUND(AVG(confidence)::numeric, 1) as avg_confidence,
        COUNT(CASE WHEN confidence >= 90 THEN 1 END) as high_confidence,
        COUNT(CASE WHEN confidence < 50 THEN 1 END) as low_confidence,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d
      FROM classification_history
    `);

    return result.rows[0] || {};
  }

  async function getStatsByMethod() {
    const result = await db.query(`
      SELECT 
        method,
        COUNT(*) as count,
        ROUND(AVG(confidence)::numeric, 1) as avg_confidence
      FROM classification_history
      WHERE method IS NOT NULL
      GROUP BY method
      ORDER BY count DESC
    `);

    const methodLabels = {
      exact_match: 'Exact Match',
      learned_pattern: 'Learned Pattern',
      policy_auto: 'Policy Engine',
      policy_engine: 'Policy Engine',
      policy_prompt: 'Policy Engine',
      policy_confirm: 'Policy Confirmed',
      policy_supported_by_related_evidence: 'Related Evidence',
      ai_analysis: 'AI Analysis',
      ai_fallback: 'AI Analysis',
      ai_verified: 'AI Verified',
      source_library: 'Source Library',
      manual_classification: 'Manual',
      manual_correction: 'Manual',
      existing_media: 'Existing Media',
      reclassification: 'Reclassified',
      rule_match: 'Rule Match',
      custom_rule: 'Custom Rule',
    };

    return result.rows.map((row) => ({
      ...row,
      methodLabel: methodLabels[row.method]
        ?? row.method?.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        ?? 'Unknown',
    }));
  }

  async function getConfidenceDistribution() {
    const result = await db.query(`
      SELECT 
        level,
        COUNT(*) as count,
        ROUND(AVG(avg_conf)::numeric, 1) as avg_confidence
      FROM (
        SELECT 
          confidence as avg_conf,
          CASE 
            WHEN confidence >= 90 THEN 'high'
            WHEN confidence >= 50 THEN 'medium'
            ELSE 'low'
          END as level
        FROM classification_history
      ) sub
      GROUP BY level
      ORDER BY 
        CASE level
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END
    `);

    return result.rows;
  }

  async function getQueueHealth() {
    try {
      return await getClassificationQueueHealth(db);
    } catch (_error) {
      return { pending: 0, processing: 0, completed_today: 0, failed: 0, total: 0, success_rate: 100 };
    }
  }

  async function getDailyStats(days) {
    const result = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        ROUND(AVG(confidence)::numeric, 1) as avg_confidence
      FROM classification_history
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return result.rows;
  }

  return {
    getOverallStats,
    getStatsByLibrary: async function getStatsByLibrary() {
      const result = await db.query(`
        SELECT 
          l.id,
          l.name,
          COUNT(ch.id) as count,
          ROUND(AVG(ch.confidence)::numeric, 1) as avg_confidence
        FROM libraries l
        LEFT JOIN classification_history ch ON l.id = ch.library_id
        GROUP BY l.id, l.name
        ORDER BY count DESC
      `);

      return result.rows;
    },
    getStatsByMethod,
    getConfidenceDistribution,
    getQueueHealth,
    getDailyStats,
  };
}

export function registerClassificationStatsRoutes(router, { db }) {
  const {
    getOverallStats,
    getStatsByLibrary,
    getStatsByMethod,
    getConfidenceDistribution,
    getQueueHealth,
    getDailyStats,
  } = createStatsHelpers(db);

  router.get('/', asyncHandler(async (_req, res) => {
    const [overall, byMethod] = await Promise.all([
      getOverallStats(),
      getStatsByMethod(),
    ]);
    return sendData(res, { ...overall, byMethod });
  }));

  router.get('/detailed', asyncHandler(async (_req, res) => {
    const [overall, byLibrary, byMethod, confidenceDistribution, queueHealth, daily] = await Promise.all([
      getOverallStats(),
      getStatsByLibrary(),
      getStatsByMethod(),
      getConfidenceDistribution(),
      getQueueHealth(),
      getDailyStats(30),
    ]);

    return sendData(res, {
      overall,
      byLibrary,
      byMethod,
      confidenceDistribution,
      queueHealth,
      daily,
    });
  }));

  router.get('/daily', asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days, 10) || 30;
    const stats = await getDailyStats(days);
    return sendData(res, stats);
  }));
}
