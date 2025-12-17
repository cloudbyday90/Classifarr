const express = require('express');
const db = require('../config/database');
const classificationService = require('../services/classification');
const contentTypeAnalyzer = require('../services/contentTypeAnalyzer');
const tmdbService = require('../services/tmdb');

const router = express.Router();

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
    const { page = 1, limit = 50, media_type, library_id, method } = req.query;
    const offset = (page - 1) * limit;

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

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const query = `
      SELECT 
        ch.*,
        l.name as library_name,
        (SELECT COUNT(*) FROM classification_corrections WHERE classification_id = ch.id) as correction_count
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      ${whereClause}
      ORDER BY ch.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM classification_history ch
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params.slice(0, -2));

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(countResult.rows[0].total / limit),
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
      'SELECT library_id, tmdb_id, metadata FROM classification_history WHERE id = $1',
      [classification_id]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Classification not found' });
    }

    const { library_id: original_library_id, tmdb_id, metadata } = classResult.rows[0];

    // Update classification
    await db.query(
      'UPDATE classification_history SET library_id = $1, status = $2 WHERE id = $3',
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

    // Extract learning pattern
    await db.query(
      `INSERT INTO learning_patterns (tmdb_id, library_id, pattern_type, pattern_data, confidence)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [tmdb_id, corrected_library_id, 'exact_match', metadata, 100.00]
    );

    res.json(correctionResult.rows[0]);
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
    // Total classifications
    const totalResult = await db.query('SELECT COUNT(*) as total FROM classification_history');
    
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
 * /api/classification/analyze-content:
 *   post:
 *     summary: Test content analysis on a specific title
 */
router.post('/analyze-content', async (req, res) => {
  try {
    const { tmdb_id, media_type } = req.body;
    
    if (!tmdb_id || !media_type) {
      return res.status(400).json({ error: 'tmdb_id and media_type are required' });
    }
    
    // Get metadata from TMDB
    let details;
    if (media_type === 'movie') {
      details = await tmdbService.getMovieDetails(tmdb_id);
    } else {
      details = await tmdbService.getTVDetails(tmdb_id);
    }
    
    const certification = await tmdbService.getCertification(tmdb_id, media_type);
    
    const metadata = {
      tmdb_id: tmdb_id,
      media_type: media_type,
      title: details.title || details.name,
      original_title: details.original_title || details.original_name,
      year: details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4),
      overview: details.overview,
      genres: details.genres?.map(g => g.name) || [],
      keywords: details.keywords?.keywords?.map(k => k.name) || details.keywords?.results?.map(k => k.name) || [],
      certification: certification,
      original_language: details.original_language,
    };
    
    // Run content analysis
    const analysis = contentTypeAnalyzer.analyze(metadata);
    
    res.json({
      title: metadata.title,
      original_genres: metadata.genres,
      analysis
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/classification/content-analysis/stats:
 *   get:
 *     summary: Get content analysis statistics
 */
router.get('/content-analysis/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        detected_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE overrides_genre) as overrides,
        AVG(confidence) as avg_confidence
      FROM content_analysis_log
      GROUP BY detected_type
      ORDER BY count DESC
    `);
    
    res.json(stats.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
