/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Statistics and analytics routes
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('StatsRoutes');

// Alert thresholds configuration
const ALERT_THRESHOLDS = {
  HIGH_CORRECTION_RATE_PERCENT: 20,  // Alert if correction rate exceeds this percentage
  PENDING_SUGGESTIONS_MIN: 5          // Alert if pending suggestions exceed this count
};

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get overall statistics
 */
router.get('/', async (req, res) => {
  try {
    const stats = await getOverallStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/detailed:
 *   get:
 *     summary: Get detailed analytics
 */
router.get('/detailed', async (req, res) => {
  try {
    const [
      overall,
      byLibrary,
      byMethod,
      confidenceDistribution,
      queueHealth,
      daily
    ] = await Promise.all([
      getOverallStats(),
      getStatsByLibrary(),
      getStatsByMethod(),
      getConfidenceDistribution(),
      getQueueHealth(),
      getDailyStats(30)
    ]);

    res.json({
      overall,
      byLibrary,
      byMethod,
      confidenceDistribution,
      queueHealth,
      daily
    });
  } catch (error) {
    logger.error('Failed to get detailed stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/daily:
 *   get:
 *     summary: Get daily classification counts
 */
router.get('/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await getDailyStats(days);
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get daily stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/overview:
 *   get:
 *     summary: Get global policy stats overview
 *     responses:
 *       200:
 *         description: Global policy statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_policies:
 *                   type: integer
 *                 total_decisions:
 *                   type: integer
 *                 avg_accuracy:
 *                   type: number
 *                   format: float
 *                 improving_count:
 *                   type: integer
 *                 declining_count:
 *                   type: integer
 *                 total_auto_classified:
 *                   type: integer
 *                 auto_rate:
 *                   type: number
 *                   format: float
 */
router.get('/overview', async (req, res) => {
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
    
    // Normalize numeric fields
    const totalDecisions = Number(overview.total_decisions) || 0;
    const totalAutoClassified = Number(overview.total_auto_classified) || 0;
    overview.total_decisions = totalDecisions;
    overview.total_auto_classified = totalAutoClassified;

    // Calculate auto rate safely, avoiding division by zero
    if (totalDecisions > 0 && totalAutoClassified > 0) {
      overview.auto_rate = totalAutoClassified / totalDecisions;
    } else {
      overview.auto_rate = 0;
    }

    res.json(overview);
  } catch (error) {
    logger.error('Failed to get overview stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/policies/{id}:
 *   get:
 *     summary: Get detailed stats for a policy
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Policy identifier
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detailed policy statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 policy_id:
 *                   type: integer
 *                 total_decisions:
 *                   type: integer
 *                 accuracy_rate:
 *                   type: number
 *                   format: float
 *                 time_series:
 *                   type: array
 *                   items:
 *                     type: object
 *                 prompt_breakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       prompt_type:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       accuracy:
 *                         type: number
 *       404:
 *         description: Policy stats not found
 *       500:
 *         description: Server error
 */
router.get('/policies/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate policy ID
    const policyId = parseInt(id, 10);
    if (!Number.isFinite(policyId) || !Number.isInteger(policyId) || policyId <= 0) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }

    // Get learning stats
    const stats = await db.query(`
      SELECT * FROM policy_learning_stats WHERE policy_id = $1
    `, [policyId]);

    if (stats.rows.length === 0) {
      return res.status(404).json({ error: 'Policy stats not found' });
    }

    // Get time-series data for charts
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

    // Get breakdown by prompt type
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

    res.json({
      ...stats.rows[0],
      time_series: timeSeries.rows,
      prompt_breakdown: promptBreakdown.rows
    });
  } catch (error) {
    logger.error('Failed to get policy stats', { error: error.message, policyId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/live-feed:
 *   get:
 *     summary: Get recent activity feed
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of items to return
 *     responses:
 *       200:
 *         description: Recent activity feed items
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [decision, pattern, suggestion]
 *                   id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   was_correction:
 *                     type: boolean
 *                   policy_name:
 *                     type: string
 *                   library_name:
 *                     type: string
 */
router.get('/live-feed', async (req, res) => {
  try {
    // Validate and sanitize limit parameter
    const DEFAULT_LIMIT = 20;
    const MAX_LIMIT = 100;
    const rawLimit = req.query.limit;

    let limit = DEFAULT_LIMIT;
    if (rawLimit !== undefined) {
      const parsed = parseInt(rawLimit, 10);
      if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    }

    // Use CTE for better query optimization
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

    res.json(feed.rows);
  } catch (error) {
    logger.error('Failed to get live feed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/alerts:
 *   get:
 *     summary: Get abnormal metrics alerts
 *     responses:
 *       200:
 *         description: List of active alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [declining_accuracy, high_corrections, pending_suggestions]
 *                   severity:
 *                     type: string
 *                     enum: [warning, info]
 *                   policy_id:
 *                     type: integer
 *                   policy_name:
 *                     type: string
 *                   message:
 *                     type: string
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts = [];

    // Check for declining accuracy
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
        message: `${policy.name} accuracy dropped to ${(policy.accuracy_rate * 100).toFixed(1)}%`
      });
    }

    // Check for high correction rate
    const highCorrections = await db.query(`
      SELECT lp.id, lp.name, 
        COUNT(*) FILTER (WHERE was_correction) * 100.0 / COUNT(*) as correction_rate
      FROM policy_feedback_log pfl
      JOIN library_policies lp ON pfl.selected_policy_id = lp.id
      WHERE pfl.prompted_at >= NOW() - INTERVAL '7 days'
      GROUP BY lp.id, lp.name
      HAVING COUNT(*) FILTER (WHERE was_correction) * 100.0 / COUNT(*) > $1
    `, [ALERT_THRESHOLDS.HIGH_CORRECTION_RATE_PERCENT]);

    for (const policy of highCorrections.rows) {
      const correctionRate = policy.correction_rate || 0;
      alerts.push({
        type: 'high_corrections',
        severity: 'warning',
        policy_id: policy.id,
        policy_name: policy.name,
        message: `${policy.name} has ${correctionRate.toFixed(1)}% correction rate`
      });
    }

    // Check for pending suggestions
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
        message: `${policy.name} has ${policy.pending_count} pending tuning suggestions`
      });
    }

    res.json(alerts);
  } catch (error) {
    logger.error('Failed to get alerts', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/policies/{id}/compare:
 *   get:
 *     summary: Compare policy performance across time periods
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Policy identifier
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Period comparison data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   period:
 *                     type: string
 *                     enum: [last_7_days, previous_7_days]
 *                   decisions:
 *                     type: integer
 *                   accuracy:
 *                     type: number
 *                     format: float
 *                   auto_rate:
 *                     type: number
 *                     format: float
 */
router.get('/policies/:id/compare', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate policy ID
    const policyId = parseInt(id, 10);
    if (!Number.isFinite(policyId) || !Number.isInteger(policyId) || policyId <= 0) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }

    // Last 7 days vs previous 7 days
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

    res.json(comparison.rows);
  } catch (error) {
    logger.error('Failed to compare policy stats', { error: error.message, policyId: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/stats/policies:
 *   get:
 *     summary: Get all policies with their stats
 */
router.get('/policies', async (req, res) => {
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

    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to get policies with stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
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
    GROUP BY method
    ORDER BY count DESC
  `);

  return result.rows;
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
  } catch (error) {
    // Table might not exist
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

module.exports = router;
