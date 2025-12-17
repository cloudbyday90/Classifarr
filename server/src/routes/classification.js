const express = require('express');
const router = express.Router();
const classificationService = require('../services/classification');
const discordService = require('../services/discord');
const db = require('../db');

/**
 * POST /api/classify
 * Main classification endpoint
 */
router.post('/classify', async (req, res) => {
  try {
    const mediaData = req.body;

    // Validate required fields
    if (!mediaData.tmdbId || !mediaData.mediaType || !mediaData.title) {
      return res.status(400).json({
        error: 'Missing required fields: tmdbId, mediaType, title',
      });
    }

    console.log('Classifying media:', mediaData.title);

    // Perform classification
    const classification = await classificationService.classifyMedia(mediaData);

    // Save classification to database
    const classificationId = await classificationService.saveClassification(
      classification,
      mediaData
    );

    // Send Discord notification
    await discordService.sendClassificationNotification(
      classification,
      classificationId,
      mediaData
    );

    res.json({
      success: true,
      classificationId,
      library: classification.library,
      libraryId: classification.libraryId,
      confidence: classification.confidence,
      reason: classification.reason,
      method: classification.method,
    });
  } catch (error) {
    console.error('Classification error:', error);
    res.status(500).json({
      error: 'Classification failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/classify/test
 * Test classification with sample data
 */
router.post('/classify/test', async (req, res) => {
  try {
    const mediaData = req.body;

    // Perform classification without saving
    const classification = await classificationService.classifyMedia(mediaData);

    res.json({
      success: true,
      library: classification.library,
      libraryId: classification.libraryId,
      confidence: classification.confidence,
      reason: classification.reason,
      method: classification.method,
      metadata: classification.metadata,
    });
  } catch (error) {
    console.error('Test classification error:', error);
    res.status(500).json({
      error: 'Test classification failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/labels
 * Get all label presets
 */
router.get('/labels', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM label_presets ORDER BY category, display_name`
    );

    res.json({
      success: true,
      labels: result.rows,
    });
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({
      error: 'Failed to fetch labels',
      message: error.message,
    });
  }
});

/**
 * GET /api/labels/:category
 * Get labels by category
 */
router.get('/labels/:category', async (req, res) => {
  try {
    const { category } = req.params;

    const result = await db.query(
      `SELECT * FROM label_presets WHERE category = $1 ORDER BY display_name`,
      [category]
    );

    res.json({
      success: true,
      category,
      labels: result.rows,
    });
  } catch (error) {
    console.error('Error fetching labels by category:', error);
    res.status(500).json({
      error: 'Failed to fetch labels',
      message: error.message,
    });
  }
});

/**
 * POST /api/libraries/:id/labels
 * Set labels for a library
 */
router.post('/libraries/:id/labels', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);
    const { labels } = req.body; // Array of { labelPresetId, isInclude }

    if (!Array.isArray(labels)) {
      return res.status(400).json({
        error: 'labels must be an array',
      });
    }

    // Start transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Delete existing labels for this library
      await client.query(
        'DELETE FROM library_labels WHERE library_id = $1',
        [libraryId]
      );

      // Insert new labels
      for (const label of labels) {
        await client.query(
          `INSERT INTO library_labels (library_id, label_preset_id, is_include)
           VALUES ($1, $2, $3)`,
          [libraryId, label.labelPresetId, label.isInclude !== false]
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Labels updated successfully',
        count: labels.length,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error setting library labels:', error);
    res.status(500).json({
      error: 'Failed to set library labels',
      message: error.message,
    });
  }
});

/**
 * GET /api/libraries/:id/labels
 * Get labels for a library
 */
router.get('/libraries/:id/labels', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);

    const result = await db.query(
      `SELECT ll.*, lp.category, lp.name, lp.display_name, lp.media_type, lp.description
       FROM library_labels ll
       JOIN label_presets lp ON lp.id = ll.label_preset_id
       WHERE ll.library_id = $1
       ORDER BY lp.category, lp.display_name`,
      [libraryId]
    );

    res.json({
      success: true,
      libraryId,
      labels: result.rows,
    });
  } catch (error) {
    console.error('Error fetching library labels:', error);
    res.status(500).json({
      error: 'Failed to fetch library labels',
      message: error.message,
    });
  }
});

/**
 * POST /api/libraries/:id/rules
 * Add custom rule to library
 */
router.post('/libraries/:id/rules', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);
    const {
      ruleName,
      ruleDescription,
      ruleLogic,
      isInclude = true,
      priority = 10,
      enabled = true,
    } = req.body;

    if (!ruleLogic) {
      return res.status(400).json({
        error: 'ruleLogic is required',
      });
    }

    const result = await db.query(
      `INSERT INTO library_custom_rules 
       (library_id, rule_name, rule_description, rule_logic, is_include, priority, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        libraryId,
        ruleName || 'Custom Rule',
        ruleDescription,
        JSON.stringify(ruleLogic),
        isInclude,
        priority,
        enabled,
      ]
    );

    res.json({
      success: true,
      rule: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding custom rule:', error);
    res.status(500).json({
      error: 'Failed to add custom rule',
      message: error.message,
    });
  }
});

/**
 * GET /api/libraries/:id/rules
 * Get custom rules for library
 */
router.get('/libraries/:id/rules', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);

    const result = await db.query(
      `SELECT * FROM library_custom_rules
       WHERE library_id = $1
       ORDER BY priority ASC, created_at DESC`,
      [libraryId]
    );

    res.json({
      success: true,
      libraryId,
      rules: result.rows,
    });
  } catch (error) {
    console.error('Error fetching library rules:', error);
    res.status(500).json({
      error: 'Failed to fetch library rules',
      message: error.message,
    });
  }
});

/**
 * PUT /api/libraries/:id/rules/:ruleId
 * Update a custom rule
 */
router.put('/libraries/:id/rules/:ruleId', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);
    const ruleId = parseInt(req.params.ruleId);
    const {
      ruleName,
      ruleDescription,
      ruleLogic,
      isInclude,
      priority,
      enabled,
    } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (ruleName !== undefined) {
      updates.push(`rule_name = $${paramCount++}`);
      values.push(ruleName);
    }
    if (ruleDescription !== undefined) {
      updates.push(`rule_description = $${paramCount++}`);
      values.push(ruleDescription);
    }
    if (ruleLogic !== undefined) {
      updates.push(`rule_logic = $${paramCount++}`);
      values.push(JSON.stringify(ruleLogic));
    }
    if (isInclude !== undefined) {
      updates.push(`is_include = $${paramCount++}`);
      values.push(isInclude);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramCount++}`);
      values.push(enabled);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 1) {
      return res.status(400).json({
        error: 'No fields to update',
      });
    }

    values.push(ruleId);
    values.push(libraryId);

    const result = await db.query(
      `UPDATE library_custom_rules 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND library_id = $${paramCount++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Rule not found',
      });
    }

    res.json({
      success: true,
      rule: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating custom rule:', error);
    res.status(500).json({
      error: 'Failed to update custom rule',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/libraries/:id/rules/:ruleId
 * Delete a custom rule
 */
router.delete('/libraries/:id/rules/:ruleId', async (req, res) => {
  try {
    const libraryId = parseInt(req.params.id);
    const ruleId = parseInt(req.params.ruleId);

    const result = await db.query(
      `DELETE FROM library_custom_rules 
       WHERE id = $1 AND library_id = $2
       RETURNING *`,
      [ruleId, libraryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Rule not found',
      });
    }

    res.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting custom rule:', error);
    res.status(500).json({
      error: 'Failed to delete custom rule',
      message: error.message,
    });
  }
});

module.exports = router;
