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
const classificationService = require('../services/classification');
const classificationRetryService = require('../services/classificationRetryService');
const classificationOutcomeService = require('../services/classificationOutcomeService');
const reclassificationService = require('../services/reclassificationService');
const clarificationService = require('../services/clarificationService');
const patternReinforcementService = require('../services/patternReinforcementService');
const { PATTERN_SIGNAL_TYPES } = require('../services/signalCollector');
const { createLogger } = require('../utils/logger');
const { requireReadWrite } = require('../middleware/apiKeyAuth');
const { STALE_AWAITING_DECISION_DAYS } = require('../constants/classificationFlow');
const { randomUUID } = require('crypto');

const router = express.Router();
const logger = createLogger('classification');

function safeParseJsonObject(value, fallback = {}) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function parseOptionalBoolean(value, defaultValue = true) {
  if (value === undefined) {
    return { valid: true, value: defaultValue };
  }

  if (typeof value === 'boolean') {
    return { valid: true, value };
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return { valid: true, value: true };
    }
    if (normalized === 'false') {
      return { valid: true, value: false };
    }
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return { valid: true, value: true };
    }
    if (value === 0) {
      return { valid: true, value: false };
    }
  }

  return { valid: false, value: defaultValue };
}

function parsePositiveIntWithBounds(value, fallback, { min = 1, max = 365 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function buildOutcomeRateSet({ total, linkedOutcomes, verified, corrected, resolved, retried }) {
  const perTotal = {
    linkedOutcomeRate: total > 0 ? Number((linkedOutcomes / total).toFixed(4)) : 0,
    correctedRate: total > 0 ? Number((corrected / total).toFixed(4)) : 0,
    verifiedRate: total > 0 ? Number((verified / total).toFixed(4)) : 0,
    resolvedRate: total > 0 ? Number((resolved / total).toFixed(4)) : 0,
    retriedRate: total > 0 ? Number((retried / total).toFixed(4)) : 0
  };

  const perLinkedOutcome = {
    correctedRate: linkedOutcomes > 0 ? Number((corrected / linkedOutcomes).toFixed(4)) : 0,
    verifiedRate: linkedOutcomes > 0 ? Number((verified / linkedOutcomes).toFixed(4)) : 0,
    resolvedRate: linkedOutcomes > 0 ? Number((resolved / linkedOutcomes).toFixed(4)) : 0,
    retriedRate: linkedOutcomes > 0 ? Number((retried / linkedOutcomes).toFixed(4)) : 0
  };

  return { perTotal, perLinkedOutcome };
}

function createEmptyOutcomeTypeBreakdown() {
  return {
    verified: 0,
    corrected: 0,
    resolved: 0,
    retried: 0
  };
}

/**
 * @swagger
 * /api/classification/classify:
 *   post:
 *     summary: Manually classify media
 *     description: Classify a media item by TMDB ID
 */
router.post('/classify', async (req, res) => {
  try {
    const { tmdb_id, media_type, title } = req.body;

    if (!tmdb_id || !media_type) {
      return res.status(400).json({ error: 'tmdb_id and media_type are required' });
    }

    // Create a mock Overseerr payload
    const payload = {
      media: {
        media_type,
        tmdbId: tmdb_id,
      },
      subject: title || `${media_type === 'movie' ? 'Movie' : 'TV Show'} Request`,
    };

    const result = await classificationService.classify(payload);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/history:
 *   get:
 *     summary: Get classification history
 */
router.get('/history', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      media_type,
      library_id,
      method,
      excludeMethod,
      search,
      date_from,
      date_to,
    } = req.query;

    const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
    const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offset = (normalizedPage - 1) * normalizedLimit;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (media_type) {
      whereConditions.push(`ch.media_type = $${paramIndex}`);
      params.push(media_type);
      paramIndex++;
    }

    if (library_id) {
      whereConditions.push(`ch.library_id = $${paramIndex}`);
      params.push(library_id);
      paramIndex++;
    }

    if (method) {
      whereConditions.push(`ch.method = $${paramIndex}`);
      params.push(method);
      paramIndex++;
    }

    // Exclude specific methods (e.g., source_library for Dashboard)
    if (excludeMethod) {
      whereConditions.push(`ch.method != $${paramIndex}`);
      params.push(excludeMethod);
      paramIndex++;
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      whereConditions.push(`ch.title ILIKE $${paramIndex}`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (date_from) {
      whereConditions.push(`ch.created_at >= $${paramIndex}`);
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`ch.created_at < ($${paramIndex}::date + INTERVAL '1 day')`);
      params.push(date_to);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Snapshot filter-only params before appending LIMIT/OFFSET so the
    // fallback COUNT query can reuse the same positional params.
    const filterParams = [...params];

    const query = `
      SELECT 
        ch.*,
        l.name as library_name,
        (SELECT COUNT(*) FROM classification_corrections WHERE classification_id = ch.id) as correction_count,
        COUNT(*) OVER() AS total_count
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      ${whereClause}
      ORDER BY ch.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(normalizedLimit, offset);
    const result = await db.query(query, params);

    let total;
    if (result.rows.length > 0) {
      // Common path: window function carries the real total in every row.
      total = parseInt(result.rows[0].total_count);
    } else {
      // Out-of-range page: OFFSET exceeded all matching rows so no rows were
      // returned, but the dataset is not necessarily empty.  Run a cheap
      // COUNT(*) using the same WHERE clause to get the real total so the
      // client can recover correct pagination metadata.
      const countQuery = `
        SELECT COUNT(*) AS count
        FROM classification_history ch
        LEFT JOIN libraries l ON ch.library_id = l.id
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, filterParams);
      total = parseInt(countResult.rows[0].count);
    }

    res.json({
      data: result.rows.map(row => {
        const { total_count: _total_count, ...rest } = row;
        return rest;
      }),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/history/{id}:
 *   get:
 *     summary: Get classification details
 */
router.get('/history/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        ch.*,
        l.name as library_name,
        l.media_type as library_media_type
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      WHERE ch.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classification not found' });
    }

    // Get corrections
    const corrections = await db.query(`
      SELECT 
        cc.*,
        l.name as corrected_library_name
      FROM classification_corrections cc
      LEFT JOIN libraries l ON cc.corrected_library_id = l.id
      WHERE cc.classification_id = $1
      ORDER BY cc.created_at DESC
    `, [id]);

    res.json({
      ...result.rows[0],
      corrections: corrections.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/corrections:
 *   post:
 *     summary: Submit a classification correction
 */
router.post('/corrections', async (req, res) => {
  try {
    const { classification_id, corrected_library_id, corrected_by } = req.body;

    if (!classification_id || !corrected_library_id) {
      return res.status(400).json({ error: 'classification_id and corrected_library_id are required' });
    }

    // Get original classification
    const classResult = await db.query(
      'SELECT library_id, tmdb_id, media_type, metadata FROM classification_history WHERE id = $1',
      [classification_id]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Classification not found' });
    }

    const { library_id: original_library_id, tmdb_id, media_type, metadata } = classResult.rows[0];

    // Update classification with library_id and library_name
    await db.query(
      `UPDATE classification_history 
       SET library_id = $1, 
           library_name = (SELECT name FROM libraries WHERE id = $1),
           status = $2 
       WHERE id = $3`,
      [corrected_library_id, 'corrected', classification_id]
    );
    // Save correction
    const correctionResult = await db.query(
      `INSERT INTO classification_corrections 
       (classification_id, original_library_id, corrected_library_id, corrected_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [classification_id, original_library_id, corrected_library_id, corrected_by || 'user']
    );
    const correctedLibraryLookup = await db.query(
      'SELECT name FROM libraries WHERE id = $1',
      [corrected_library_id]
    );
    await classificationOutcomeService.recordOutcome(classification_id, {
      type: 'corrected',
      source: 'api_correction',
      actor: corrected_by || 'user',
      final_library_id: corrected_library_id,
      final_library_name: correctedLibraryLookup.rows[0]?.name || null
    });

    // Extract learning pattern
    await db.query(
      `INSERT INTO learning_patterns (tmdb_id, media_type, library_id, pattern_type, pattern_data, confidence)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [tmdb_id, media_type || 'unknown', corrected_library_id, 'exact_match', metadata, 100.00]
    );

    // Pattern reinforcement - async, don't wait
    setImmediate(async () => {
      try {
        // Get pattern signals from classification
        const signalsResult = await db.query(
          'SELECT signals_json FROM classification_history WHERE id = $1',
          [classification_id]
        );
        
        if (signalsResult.rows.length > 0 && signalsResult.rows[0].signals_json) {
          const signals = signalsResult.rows[0].signals_json;
          // Use shared constant for filtering pattern signals
          const patternSignals = signals.filter(s => s.type && PATTERN_SIGNAL_TYPES.includes(s.type));
          
          if (patternSignals.length > 0) {
            await patternReinforcementService.reinforceOnCorrection(
              classification_id,
              patternSignals,
              corrected_library_id
            );
          }
        }
      } catch (error) {
        // Log error for debugging but don't fail the request
        logger.error('Pattern reinforcement failed for classification', {
          classification_id,
          error: error.message
        });
      }
    });

    res.json(correctionResult.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/reclassify:
 *   post:
 *     summary: Execute a full re-classification with media move
 *     description: Corrects classification AND moves media files in *arr
 */
router.post('/reclassify', async (req, res) => {
  try {
    const { classification_id, target_library_id, corrected_by } = req.body;

    if (!classification_id || !target_library_id) {
      return res.status(400).json({ error: 'classification_id and target_library_id are required' });
    }

    // Execute the full re-classification (DB update + *arr media move)
    const result = await reclassificationService.executeReclassification({
      classificationId: classification_id,
      targetLibraryId: target_library_id,
      correctedBy: corrected_by || 'user'
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/reclassify/preview:
 *   post:
 *     summary: Preview a re-classification without executing
 */
router.post('/reclassify/preview', async (req, res) => {
  try {
    const { classification_id, target_library_id } = req.body;

    if (!classification_id || !target_library_id) {
      return res.status(400).json({ error: 'classification_id and target_library_id are required' });
    }

    const preview = await reclassificationService.previewReclassification({
      classificationId: classification_id,
      targetLibraryId: target_library_id
    });

    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/stats:
 *   get:
 *     summary: Get classification statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Total classifications (exclude source_library - those are enrichments, not new classifications)
    const totalResult = await db.query("SELECT COUNT(*) as total FROM classification_history WHERE method != 'source_library'");

    // By method
    const methodResult = await db.query(`
      SELECT method, COUNT(*) as count
      FROM classification_history
      GROUP BY method
      ORDER BY count DESC
    `);

    // By library
    const libraryResult = await db.query(`
      SELECT l.name, COUNT(*) as count
      FROM classification_history ch
      JOIN libraries l ON ch.library_id = l.id
      GROUP BY l.id, l.name
      ORDER BY count DESC
      LIMIT 10
    `);

    // Average confidence by method
    const confidenceResult = await db.query(`
      SELECT method, AVG(confidence) as avg_confidence
      FROM classification_history
      WHERE confidence IS NOT NULL
      GROUP BY method
    `);

    // Recent activity (last 7 days)
    const activityResult = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM classification_history
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({
      total: parseInt(totalResult.rows[0].total),
      byMethod: methodResult.rows,
      byLibrary: libraryResult.rows,
      avgConfidence: confidenceResult.rows,
      recentActivity: activityResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/second-pass-evaluation:
 *   get:
 *     summary: Get outcome cohorts for second-pass evaluation
 *     description: Compares baseline classifications against second-pass ran/not-adopted and second-pass adopted cohorts, linked to later human or retry outcomes.
 */
router.get('/second-pass-evaluation', async (req, res) => {
  try {
    const days = parsePositiveIntWithBounds(req.query.days, 30, { min: 1, max: 365 });

    const result = await db.query(
      `WITH classified AS (
         SELECT
           CASE
             WHEN COALESCE((metadata->'classification_details'->'rag_loop_summary'->>'ran')::boolean, false) = false
               THEN 'baseline'
             WHEN COALESCE((metadata->'classification_details'->'rag_loop_summary'->>'adopted')::boolean, false) = true
               THEN 'pass2_adopted'
             ELSE 'pass2_not_adopted'
           END AS cohort,
           COALESCE(
             NULLIF(metadata->'classification_details'->'outcome_path'->>'latest_type', ''),
             NULLIF(metadata->'classification_details'->'outcome_link'->>'type', '')
           ) AS latest_outcome_type,
           NULLIF(metadata->'classification_details'->'outcome_path'->>'first_type', '') AS first_outcome_type,
           COALESCE((metadata->'classification_details'->'outcome_path'->>'has_multi_step')::boolean, false) AS has_multi_step
         FROM classification_history
         WHERE method != 'source_library'
           AND created_at >= NOW() - ($1 || ' days')::INTERVAL
       )
       SELECT
         cohort,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE latest_outcome_type IS NOT NULL)::int AS linked_outcomes,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'verified')::int AS verified,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'corrected')::int AS corrected,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'resolved')::int AS resolved,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'retried')::int AS retried,
         COUNT(*) FILTER (WHERE first_outcome_type = 'verified')::int AS first_verified,
         COUNT(*) FILTER (WHERE first_outcome_type = 'corrected')::int AS first_corrected,
         COUNT(*) FILTER (WHERE first_outcome_type = 'resolved')::int AS first_resolved,
         COUNT(*) FILTER (WHERE first_outcome_type = 'retried')::int AS first_retried,
         COUNT(*) FILTER (WHERE has_multi_step = true)::int AS multi_step_outcomes
       FROM classified
       GROUP BY cohort
       ORDER BY cohort ASC`,
      [days]
    );

    const defaultCohorts = {
      baseline: {
        cohort: 'baseline',
        total: 0,
        linkedOutcomes: 0,
        verified: 0,
        corrected: 0,
        resolved: 0,
        retried: 0,
        multiStepOutcomes: 0,
        firstOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
        latestOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
        perTotal: {
          linkedOutcomeRate: 0,
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        perLinkedOutcome: {
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        linkedOutcomeRate: 0,
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      },
      pass2_not_adopted: {
        cohort: 'pass2_not_adopted',
        total: 0,
        linkedOutcomes: 0,
        verified: 0,
        corrected: 0,
        resolved: 0,
        retried: 0,
        multiStepOutcomes: 0,
        firstOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
        latestOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
        perTotal: {
          linkedOutcomeRate: 0,
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        perLinkedOutcome: {
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        linkedOutcomeRate: 0,
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      },
      pass2_adopted: {
        cohort: 'pass2_adopted',
        total: 0,
        linkedOutcomes: 0,
        verified: 0,
        corrected: 0,
        resolved: 0,
        retried: 0,
        multiStepOutcomes: 0,
        firstOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
        latestOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
        perTotal: {
          linkedOutcomeRate: 0,
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        perLinkedOutcome: {
          correctedRate: 0,
          verifiedRate: 0,
          resolvedRate: 0,
          retriedRate: 0
        },
        linkedOutcomeRate: 0,
        correctedRate: 0,
        verifiedRate: 0,
        resolvedRate: 0,
        retriedRate: 0
      }
    };

    for (const row of result.rows) {
      if (!defaultCohorts[row.cohort]) continue;
      const total = Number.parseInt(row.total, 10) || 0;
      const linkedOutcomes = Number.parseInt(row.linked_outcomes, 10) || 0;
      const corrected = Number.parseInt(row.corrected, 10) || 0;
      const verified = Number.parseInt(row.verified, 10) || 0;
      const resolved = Number.parseInt(row.resolved, 10) || 0;
      const retried = Number.parseInt(row.retried, 10) || 0;
      const multiStepOutcomes = Number.parseInt(row.multi_step_outcomes, 10) || 0;
      const firstOutcomeBreakdown = {
        verified: Number.parseInt(row.first_verified, 10) || 0,
        corrected: Number.parseInt(row.first_corrected, 10) || 0,
        resolved: Number.parseInt(row.first_resolved, 10) || 0,
        retried: Number.parseInt(row.first_retried, 10) || 0
      };
      const rateSet = buildOutcomeRateSet({
        total,
        linkedOutcomes,
        verified,
        corrected,
        resolved,
        retried
      });

      defaultCohorts[row.cohort] = {
        cohort: row.cohort,
        total,
        linkedOutcomes,
        verified,
        corrected,
        resolved,
        retried,
        multiStepOutcomes,
        firstOutcomeBreakdown,
        latestOutcomeBreakdown: {
          verified,
          corrected,
          resolved,
          retried
        },
        perTotal: rateSet.perTotal,
        perLinkedOutcome: rateSet.perLinkedOutcome,
        linkedOutcomeRate: rateSet.perTotal.linkedOutcomeRate,
        correctedRate: rateSet.perLinkedOutcome.correctedRate,
        verifiedRate: rateSet.perLinkedOutcome.verifiedRate,
        resolvedRate: rateSet.perLinkedOutcome.resolvedRate,
        retriedRate: rateSet.perLinkedOutcome.retriedRate
      };
    }

    const cohorts = [
      defaultCohorts.baseline,
      defaultCohorts.pass2_not_adopted,
      defaultCohorts.pass2_adopted
    ];
    const totals = cohorts.reduce((acc, cohort) => {
      acc.total += cohort.total;
      acc.linkedOutcomes += cohort.linkedOutcomes;
      acc.verified += cohort.verified;
      acc.corrected += cohort.corrected;
      acc.resolved += cohort.resolved;
      acc.retried += cohort.retried;
      acc.multiStepOutcomes += cohort.multiStepOutcomes;
      acc.firstOutcomeBreakdown.verified += cohort.firstOutcomeBreakdown.verified;
      acc.firstOutcomeBreakdown.corrected += cohort.firstOutcomeBreakdown.corrected;
      acc.firstOutcomeBreakdown.resolved += cohort.firstOutcomeBreakdown.resolved;
      acc.firstOutcomeBreakdown.retried += cohort.firstOutcomeBreakdown.retried;
      return acc;
    }, {
      total: 0,
      linkedOutcomes: 0,
      verified: 0,
      corrected: 0,
      resolved: 0,
      retried: 0,
      multiStepOutcomes: 0,
      firstOutcomeBreakdown: createEmptyOutcomeTypeBreakdown()
    });

    const totalRateSet = buildOutcomeRateSet(totals);

    res.json({
      windowDays: days,
      totals: {
        ...totals,
        latestOutcomeBreakdown: {
          verified: totals.verified,
          corrected: totals.corrected,
          resolved: totals.resolved,
          retried: totals.retried
        },
        perTotal: totalRateSet.perTotal,
        perLinkedOutcome: totalRateSet.perLinkedOutcome,
        linkedOutcomeRate: totalRateSet.perTotal.linkedOutcomeRate,
        correctedRate: totalRateSet.perLinkedOutcome.correctedRate,
        verifiedRate: totalRateSet.perLinkedOutcome.verifiedRate,
        resolvedRate: totalRateSet.perLinkedOutcome.resolvedRate,
        retriedRate: totalRateSet.perLinkedOutcome.retriedRate
      },
      cohorts
    });
  } catch (error) {
    logger.error('Failed to load second-pass evaluation stats', { error: error.message });
    res.status(500).json({ error: 'Failed to load second-pass evaluation stats' });
  }
});

/**
 * @swagger
 * /api/classification/live-feed:
 *   get:
 *     summary: Get recent classification activity for live dashboard
 *     description: Returns last 50 classifications from the past 24 hours
 */
router.get('/live-feed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const result = await db.query(`
      SELECT 
        ch.id,
        ch.title,
        ch.media_type,
        ch.method,
        ch.confidence,
        ch.created_at,
        l.name as library_name
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      WHERE ch.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY ch.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      items: result.rows.map(row => ({
        id: row.id,
        title: row.title,
        mediaType: row.media_type,
        method: row.method,
        confidence: row.confidence,
        library: row.library_name,
        timestamp: row.created_at
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/pending:
 *   get:
 *     summary: Get pending classifications awaiting policy decisions
 *     description: Returns all items with status='pending' that need user decision
 */
router.get('/pending', async (req, res) => {
  try {
    const pending = await clarificationService.getPendingClassifications();

    const safeParsePolicyQuestion = (value) => {
      if (!value) return null;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return null;
      }
      try {
        return JSON.parse(trimmed);
      } catch (_error) {
        return null;
      }
    };

    // Parse policy_question JSON for each item
    // policy_question is JSONB in PostgreSQL (already parsed as object)
    // Handle both string (old data) and object (current format)
    const items = pending.map(item => ({
      ...item,
      policy_question: safeParsePolicyQuestion(item.policy_question),
    }));

    res.json({
      count: items.length,
      items,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/pending/{id}/resolve:
 *   post:
 *     summary: Resolve a pending classification
 *     description: User selects a library for a pending item, generates learned rule
 */
router.post('/pending/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { library_id, selected_option, resolved_by = 'admin', generate_rule = true } = req.body;

    if (!library_id) {
      return res.status(400).json({ error: 'library_id is required' });
    }

    const classificationId = Number.parseInt(id, 10);
    const libraryId = Number.parseInt(library_id, 10);

    if (!Number.isInteger(classificationId) || classificationId < 1) {
      return res.status(400).json({ error: 'Invalid classification id' });
    }

    if (!Number.isInteger(libraryId) || libraryId < 1) {
      return res.status(400).json({ error: 'Invalid library_id' });
    }

    const parsedGenerateRule = parseOptionalBoolean(generate_rule, true);
    if (!parsedGenerateRule.valid) {
      return res.status(400).json({ error: 'Invalid generate_rule' });
    }

    const libraryExists = await db.query(
      'SELECT id FROM libraries WHERE id = $1 LIMIT 1',
      [libraryId]
    );

    if (libraryExists.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid library_id' });
    }

    const result = await clarificationService.resolvePolicyQuestion(
      classificationId,
      libraryId,
      selected_option || 'Manual selection',
      resolved_by,
      parsedGenerateRule.value
    );

    // Route to Radarr/Sonarr if resolution indicates we should
    let wasRouted = false;
    let routeError = null;
    let routingReason = null;
    
    if (result.shouldRoute && result.libraryId) {
      try {
        const classResult = await db.query(
          `SELECT ch.*, l.arr_type, l.arr_id, l.radarr_settings, l.sonarr_settings, 
                  l.root_folder, l.quality_profile_id, l.name as library_name
           FROM classification_history ch
           JOIN libraries l ON l.id = $2
           WHERE ch.id = $1`,
          [classificationId, result.libraryId]
        );

        if (classResult.rows.length > 0) {
          const row = classResult.rows[0];
          const parsedMeta = safeParseJsonObject(row.metadata, {});

          // Route if library has *arr type; routing service will resolve mapping details
          if (row.arr_type) {
            const routeResult = await classificationService.routeToArr(parsedMeta, {
              id: row.library_id,
              arr_type: row.arr_type,
              arr_id: row.arr_id,
              radarr_settings: row.radarr_settings,
              sonarr_settings: row.sonarr_settings,
              root_folder: row.root_folder,
              quality_profile_id: row.quality_profile_id,
              name: row.library_name
            });

            routingReason = routeResult?.reason || null;
            if (routeResult?.routed === true) {
              // Update status to 'routed'
              await db.query(
                'UPDATE classification_history SET status = $1 WHERE id = $2',
                ['routed', classificationId]
              );

              wasRouted = true;
              logger.info('Routed after resolution', {
                classificationId,
                title: parsedMeta.title,
                library: row.library_name
              });
            } else {
              routeError = routeResult?.error ? new Error(routeResult.error) : null;
              logger.warn('Routing skipped after resolution', {
                classificationId,
                title: parsedMeta.title,
                library: row.library_name,
                reason: routingReason || 'unknown'
              });
            }
          }
        } else {
          logger.warn('No classification/library record found for routing after resolution', {
            classificationId,
            libraryId: result.libraryId
          });
        }
      } catch (err) {
        routeError = err;
        logger.error('Failed to route after resolution', {
          classificationId,
          error: err.message
        });
        // Don't fail the resolution - classification is still resolved
      }
    }

    res.json({
      ...result,
      routed: wasRouted,
      routingError: routeError?.message || null,
      routingReason
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/retry:
 *   post:
 *     summary: Retry pending classifications with cleanup and re-queue
 *     description: Resets stale classification state and queues a fresh classification task.
 */
router.post('/retry', requireReadWrite, async (req, res) => {
  try {
    const { classificationIds, options = {} } = req.body || {};

    if (!Array.isArray(classificationIds)) {
      return res.status(400).json({ error: 'classificationIds must be an array' });
    }
    if (classificationIds.length === 0) {
      return res.status(400).json({ error: 'classificationIds must contain at least one id' });
    }
    if (classificationIds.length > 100) {
      return res.status(400).json({ error: 'classificationIds exceeds maximum batch size (100)' });
    }
    if (!classificationIds.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
      return res.status(400).json({ error: 'classificationIds must contain only positive integers' });
    }

    const actor = req.user?.username || req.user?.email || req.user?.id || 'admin';
    const correlationId = randomUUID();
    const purgeLearning = options?.purgeLearning === true;

    const result = await classificationRetryService.retryClassifications({
      classificationIds,
      actor,
      purgeLearning,
      correlationId
    });

    res.json({
      success: result.failed === 0,
      ...result
    });
  } catch (error) {
    if (error?.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Failed to retry classifications', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/pending/count:
 *   get:
 *     summary: Get count of pending classifications
 */
router.get('/pending/count', async (req, res) => {
  try {
    // Exclude rows older than STALE_AWAITING_DECISION_DAYS — they are stale (Discord delivery
    // failed, session lost, etc.) and are handled separately by the daily cleanup job.
    // classification_history has created_at but no updated_at column.
    const result = await db.query(
      `SELECT COUNT(*) as count 
       FROM classification_history 
       WHERE status = 'awaiting_decision'
         AND created_at >= NOW() - ($1 || ' days')::INTERVAL`,
      [STALE_AWAITING_DECISION_DAYS]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/history/{id}/profile:
 *   get:
 *     summary: Get library profile snapshot used for classification
 *     description: Returns the library profile statistics that were used at the time of classification
 */
router.get('/history/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get stored profile snapshot from the classification history record
    const result = await db.query(
      'SELECT profile_snapshot FROM classification_history WHERE id = $1',
      [id]
    );
    
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'Classification not found' });
    }
    
    const profileSnapshot = row.profile_snapshot;
    if (!profileSnapshot) {
      return res.status(404).json({ error: 'Classification has no stored profile snapshot' });
    }
    
    res.json(profileSnapshot);
  } catch (error) {
    logger.error('Failed to get profile snapshot for classification', {
      classificationId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to load profile snapshot' });
  }
});

module.exports = router;
