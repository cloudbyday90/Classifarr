const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const classificationService = require('../services/classification');

/**
 * Get classification history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0, media_type } = req.query;

    let sql = `
      SELECT 
        ch.*,
        l.name as library_name
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.assigned_library_id = l.id
    `;

    const params = [];
    if (media_type) {
      sql += ' WHERE ch.media_type = $1';
      params.push(media_type);
    }

    sql += ' ORDER BY ch.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get classification by ID
 */
router.get('/history/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ch.*,
        l.name as library_name,
        cc.corrected_library_id,
        cl.name as corrected_library_name
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.assigned_library_id = l.id
      LEFT JOIN classification_corrections cc ON ch.id = cc.classification_id
      LEFT JOIN libraries cl ON cc.corrected_library_id = cl.id
      WHERE ch.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classification not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get classification corrections
 */
router.get('/corrections', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        cc.*,
        ch.title,
        ch.tmdb_id,
        ol.name as original_library_name,
        cl.name as corrected_library_name
      FROM classification_corrections cc
      JOIN classification_history ch ON cc.classification_id = ch.id
      LEFT JOIN libraries ol ON cc.original_library_id = ol.id
      LEFT JOIN libraries cl ON cc.corrected_library_id = cl.id
      ORDER BY cc.created_at DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get learning patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        lp.*,
        l.name as library_name
      FROM learning_patterns lp
      JOIN libraries l ON lp.library_id = l.id
      ORDER BY lp.confidence_score DESC, lp.occurrence_count DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manually classify a media item
 */
router.post('/classify', async (req, res) => {
  try {
    const { tmdb_id, media_type, requested_by } = req.body;

    if (!tmdb_id || !media_type) {
      return res.status(400).json({ error: 'Missing required fields: tmdb_id, media_type' });
    }

    const result = await classificationService.classify({
      media: {
        tmdbId: tmdb_id,
        media_type: media_type
      },
      request: {
        requestedBy_username: requested_by || 'manual'
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get classification statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = {};

    // Total classifications
    const totalResult = await query('SELECT COUNT(*) as count FROM classification_history');
    stats.total = parseInt(totalResult.rows[0].count);

    // By media type
    const mediaTypeResult = await query(`
      SELECT media_type, COUNT(*) as count 
      FROM classification_history 
      GROUP BY media_type
    `);
    stats.byMediaType = mediaTypeResult.rows.reduce((acc, row) => {
      acc[row.media_type] = parseInt(row.count);
      return acc;
    }, {});

    // By method
    const methodResult = await query(`
      SELECT classification_method, COUNT(*) as count 
      FROM classification_history 
      GROUP BY classification_method
    `);
    stats.byMethod = methodResult.rows.reduce((acc, row) => {
      acc[row.classification_method] = parseInt(row.count);
      return acc;
    }, {});

    // Average confidence
    const confidenceResult = await query('SELECT AVG(confidence_score) as avg FROM classification_history');
    stats.averageConfidence = parseFloat(confidenceResult.rows[0].avg || 0).toFixed(2);

    // Total corrections
    const correctionsResult = await query('SELECT COUNT(*) as count FROM classification_corrections');
    stats.totalCorrections = parseInt(correctionsResult.rows[0].count);

    // Correction rate
    stats.correctionRate = stats.total > 0 
      ? ((stats.totalCorrections / stats.total) * 100).toFixed(2) + '%'
      : '0%';

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
