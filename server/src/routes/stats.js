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
