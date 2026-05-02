/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const ALERT_THRESHOLDS = {
  HIGH_CORRECTION_RATE_PERCENT: 20,
  PENDING_SUGGESTIONS_MIN: 5,
};

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

  async function getStatsByLibrary() {
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
      const result = await db.query(`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
          COUNT(CASE WHEN status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours' THEN 1 END) as completed_today,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(*) as total,
          ROUND(
            CASE 
              WHEN COUNT(CASE WHEN status IN ('completed', 'failed') THEN 1 END) > 0
              THEN (COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric /
                    COUNT(CASE WHEN status IN ('completed', 'failed') THEN 1 END)::numeric * 100)
              ELSE 100
            END, 1
          ) as success_rate
        FROM task_queue
      `);

      return result.rows[0] || { pending: 0, processing: 0, completed_today: 0, failed: 0, total: 0, success_rate: 100 };
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
    getStatsByLibrary,
    getStatsByMethod,
    getConfidenceDistribution,
    getQueueHealth,
    getDailyStats,
  };
}

export function createStatsRouter({ express, db, logger, authenticateTokenOrApiKey }) {
  const router = express.Router();
  const {
    getOverallStats,
    getStatsByLibrary,
    getStatsByMethod,
    getConfidenceDistribution,
    getQueueHealth,
    getDailyStats,
  } = createStatsHelpers(db);

  router.use(authenticateTokenOrApiKey);

  router.get('/', async (_req, res) => {
    try {
      const [overall, byMethod] = await Promise.all([
        getOverallStats(),
        getStatsByMethod(),
      ]);
      return res.json({ ...overall, byMethod });
    } catch (error) {
      logger.error('Failed to get stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/detailed', async (_req, res) => {
    try {
      const [overall, byLibrary, byMethod, confidenceDistribution, queueHealth, daily] = await Promise.all([
        getOverallStats(),
        getStatsByLibrary(),
        getStatsByMethod(),
        getConfidenceDistribution(),
        getQueueHealth(),
        getDailyStats(30),
      ]);

      return res.json({
        overall,
        byLibrary,
        byMethod,
        confidenceDistribution,
        queueHealth,
        daily,
      });
    } catch (error) {
      logger.error('Failed to get detailed stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/daily', async (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      const stats = await getDailyStats(days);
      return res.json(stats);
    } catch (error) {
      logger.error('Failed to get daily stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/overview', async (_req, res) => {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_policies,
          SUM(total_decisions) as total_decisions,
          AVG(accuracy_rate) as avg_accuracy,
          SUM(CASE WHEN trend = 'improving' THEN 1 ELSE 0 END) as improving_count,
          SUM(CASE WHEN trend = 'declining' THEN 1 ELSE 0 END) as declining_count,
          SUM(auto_classified) as total_auto_classified
        FROM policy_learning_stats
      `);

      const overview = result.rows[0] || {};
      const totalDecisions = Number(overview.total_decisions) || 0;
      const totalAutoClassified = Number(overview.total_auto_classified) || 0;
      overview.total_decisions = totalDecisions;
      overview.total_auto_classified = totalAutoClassified;
      overview.auto_rate = totalDecisions > 0 && totalAutoClassified > 0
        ? totalAutoClassified / totalDecisions
        : 0;

      return res.json(overview);
    } catch (error) {
      logger.error('Failed to get overview stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/policies/:id', async (req, res) => {
    try {
      const policyId = parseInt(req.params.id, 10);
      if (!Number.isFinite(policyId) || !Number.isInteger(policyId) || policyId <= 0) {
        return res.status(400).json({ error: 'Invalid policy ID' });
      }

      const stats = await db.query(`
        SELECT * FROM policy_learning_stats WHERE policy_id = $1
      `, [policyId]);

      if (stats.rows.length === 0) {
        return res.status(404).json({ error: 'Policy stats not found' });
      }

      const timeSeries = await db.query(`
        SELECT 
          DATE(prompted_at) as date,
          COUNT(*) as decisions,
          COUNT(*) FILTER (WHERE was_correction = false) as correct,
          COUNT(*) FILTER (WHERE was_correction = true) as corrections,
          COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') as auto_classified,
          COUNT(*) FILTER (WHERE prompt_type IN ('prompt_confirm', 'prompt_select')) as prompted
        FROM policy_feedback_log
        WHERE selected_policy_id = $1
        AND prompted_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(prompted_at)
        ORDER BY date
      `, [policyId]);

      const promptBreakdown = await db.query(`
        SELECT 
          prompt_type,
          COUNT(*) as count,
          AVG(CASE WHEN was_correction THEN 0 ELSE 1 END) as accuracy
        FROM policy_feedback_log
        WHERE selected_policy_id = $1
        AND prompted_at >= NOW() - INTERVAL '30 days'
        GROUP BY prompt_type
      `, [policyId]);

      return res.json({
        ...stats.rows[0],
        time_series: timeSeries.rows,
        prompt_breakdown: promptBreakdown.rows,
      });
    } catch (error) {
      logger.error('Failed to get policy stats', { error: error.message, policyId: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/live-feed', async (req, res) => {
    try {
      const defaultLimit = 20;
      const maxLimit = 100;
      const rawLimit = req.query.limit;

      let limit = defaultLimit;
      if (rawLimit !== undefined) {
        const parsed = parseInt(rawLimit, 10);
        if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
          limit = Math.min(parsed, maxLimit);
        }
      }

      const feed = await db.query(`
        WITH recent_decisions AS (
          SELECT 
            'decision' as type,
            pfl.id,
            pfl.title,
            pfl.prompted_at as created_at,
            pfl.was_correction,
            lp.name as policy_name,
            l.name as library_name
          FROM policy_feedback_log pfl
          JOIN library_policies lp ON pfl.selected_policy_id = lp.id
          JOIN libraries l ON pfl.selected_library_id = l.id
          ORDER BY pfl.prompted_at DESC
          LIMIT $1
        ),
        recent_patterns AS (
          SELECT 
            'pattern' as type,
            dp.id,
            dp.pattern_value as title,
            dp.created_at,
            false as was_correction,
            NULL as policy_name,
            l.name as library_name
          FROM discovered_patterns dp
          JOIN libraries l ON dp.library_id = l.id
          WHERE dp.created_at >= NOW() - INTERVAL '7 days'
          ORDER BY dp.created_at DESC
          LIMIT $1
        ),
        recent_suggestions AS (
          SELECT 
            'suggestion' as type,
            pts.id,
            pts.suggestion_type as title,
            pts.created_at,
            false as was_correction,
            lp.name as policy_name,
            NULL as library_name
          FROM policy_tuning_suggestions pts
          JOIN library_policies lp ON pts.policy_id = lp.id
          WHERE pts.created_at >= NOW() - INTERVAL '7 days'
          ORDER BY pts.created_at DESC
          LIMIT $1
        )
        SELECT * FROM recent_decisions
        UNION ALL
        SELECT * FROM recent_patterns
        UNION ALL
        SELECT * FROM recent_suggestions
        ORDER BY created_at DESC
        LIMIT $1
      `, [limit]);

      return res.json(feed.rows);
    } catch (error) {
      logger.error('Failed to get live feed', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/alerts', async (_req, res) => {
    try {
      const alerts = [];

      try {
        const declining = await db.query(`
          SELECT lp.id, lp.name, pls.accuracy_rate, pls.last_7_days_accuracy
          FROM policy_learning_stats pls
          JOIN library_policies lp ON pls.policy_id = lp.id
          WHERE pls.trend = 'declining'
          AND pls.accuracy_rate < 0.8
        `);

        for (const policy of declining.rows) {
          alerts.push({
            type: 'declining_accuracy',
            severity: 'warning',
            policy_id: policy.id,
            policy_name: policy.name,
            message: `${policy.name} accuracy dropped to ${(policy.accuracy_rate * 100).toFixed(1)}%`,
          });
        }
      } catch (err) {
        logger.debug('Could not check declining accuracy alerts', { error: err.message });
      }

      try {
        const highCorrections = await db.query(`
          SELECT lp.id, lp.name, 
            COUNT(*) FILTER (WHERE was_correction) * 100.0 / NULLIF(COUNT(*), 0) as correction_rate
          FROM policy_feedback_log pfl
          JOIN library_policies lp ON pfl.selected_policy_id = lp.id
          WHERE pfl.prompted_at >= NOW() - INTERVAL '7 days'
          GROUP BY lp.id, lp.name
          HAVING COUNT(*) FILTER (WHERE was_correction) * 100.0 / NULLIF(COUNT(*), 0) > $1
        `, [ALERT_THRESHOLDS.HIGH_CORRECTION_RATE_PERCENT]);

        for (const policy of highCorrections.rows) {
          const correctionRate = policy.correction_rate || 0;
          alerts.push({
            type: 'high_corrections',
            severity: 'warning',
            policy_id: policy.id,
            policy_name: policy.name,
            message: `${policy.name} has ${correctionRate.toFixed(1)}% correction rate`,
          });
        }
      } catch (err) {
        logger.debug('Could not check high correction rate alerts', { error: err.message });
      }

      try {
        const pendingSuggestions = await db.query(`
          SELECT lp.id, lp.name, COUNT(*) as pending_count
          FROM policy_tuning_suggestions pts
          JOIN library_policies lp ON pts.policy_id = lp.id
          WHERE pts.status = 'pending'
          GROUP BY lp.id, lp.name
          HAVING COUNT(*) >= $1
        `, [ALERT_THRESHOLDS.PENDING_SUGGESTIONS_MIN]);

        for (const policy of pendingSuggestions.rows) {
          alerts.push({
            type: 'pending_suggestions',
            severity: 'info',
            policy_id: policy.id,
            policy_name: policy.name,
            message: `${policy.name} has ${policy.pending_count} pending tuning suggestions`,
          });
        }
      } catch (err) {
        logger.debug('Could not check pending suggestion alerts', { error: err.message });
      }

      return res.json(alerts);
    } catch (error) {
      logger.error('Failed to get alerts', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/policies/:id/compare', async (req, res) => {
    try {
      const policyId = parseInt(req.params.id, 10);
      if (!Number.isFinite(policyId) || !Number.isInteger(policyId) || policyId <= 0) {
        return res.status(400).json({ error: 'Invalid policy ID' });
      }

      const comparison = await db.query(`
        SELECT 
          'last_7_days' as period,
          COUNT(*) as decisions,
          AVG(CASE WHEN was_correction THEN 0 ELSE 1 END) as accuracy,
          COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') * 100.0 / NULLIF(COUNT(*), 0) as auto_rate
        FROM policy_feedback_log
        WHERE selected_policy_id = $1
        AND prompted_at >= NOW() - INTERVAL '7 days'

        UNION ALL

        SELECT 
          'previous_7_days' as period,
          COUNT(*) as decisions,
          AVG(CASE WHEN was_correction THEN 0 ELSE 1 END) as accuracy,
          COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') * 100.0 / NULLIF(COUNT(*), 0) as auto_rate
        FROM policy_feedback_log
        WHERE selected_policy_id = $1
        AND prompted_at >= NOW() - INTERVAL '14 days'
        AND prompted_at < NOW() - INTERVAL '7 days'
      `, [policyId]);

      return res.json(comparison.rows);
    } catch (error) {
      logger.error('Failed to compare policy stats', { error: error.message, policyId: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/policies', async (_req, res) => {
    try {
      const result = await db.query(`
        SELECT 
          lp.id,
          lp.name,
          lp.library_id,
          l.name as library_name,
          pls.total_decisions,
          pls.accuracy_rate,
          pls.auto_accuracy_rate,
          pls.auto_classified,
          pls.user_corrections,
          pls.last_7_days_accuracy,
          pls.last_30_days_accuracy,
          pls.trend,
          pls.last_decision_at,
          pls.last_correction_at
        FROM library_policies lp
        LEFT JOIN libraries l ON lp.library_id = l.id
        LEFT JOIN policy_learning_stats pls ON lp.id = pls.policy_id
        WHERE lp.enabled = true
        ORDER BY lp.priority DESC, lp.name
      `);

      return res.json(result.rows);
    } catch (error) {
      logger.error('Failed to get policies with stats', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
