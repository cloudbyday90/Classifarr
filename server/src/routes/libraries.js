const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

/**
 * Get all libraries
 */
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        l.*,
        ms.name as media_server_name,
        ms.type as media_server_type,
        array_agg(
          json_build_object('id', lp.id, 'name', lp.name, 'category', lp.category, 'color', lp.color)
        ) FILTER (WHERE lp.id IS NOT NULL) as labels
      FROM libraries l
      LEFT JOIN media_server ms ON l.media_server_id = ms.id
      LEFT JOIN library_labels ll ON l.id = ll.library_id
      LEFT JOIN label_presets lp ON ll.label_id = lp.id
      GROUP BY l.id, ms.name, ms.type
      ORDER BY l.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get library by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        l.*,
        ms.name as media_server_name,
        array_agg(
          json_build_object('id', lp.id, 'name', lp.name, 'category', lp.category)
        ) FILTER (WHERE lp.id IS NOT NULL) as labels
      FROM libraries l
      LEFT JOIN media_server ms ON l.media_server_id = ms.id
      LEFT JOIN library_labels ll ON l.id = ll.library_id
      LEFT JOIN label_presets lp ON ll.label_id = lp.id
      WHERE l.id = $1
      GROUP BY l.id, ms.name
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update library
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, enabled, media_type } = req.body;

    const result = await query(`
      UPDATE libraries 
      SET name = COALESCE($1, name), 
          enabled = COALESCE($2, enabled),
          media_type = COALESCE($3, media_type),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [name, enabled, media_type, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete library
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM libraries WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }
    res.json({ message: 'Library deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get label presets
 */
router.get('/labels/presets', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM label_presets 
      ORDER BY category, name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Assign labels to library
 */
router.post('/:id/labels', async (req, res) => {
  try {
    const { labelIds } = req.body;

    if (!Array.isArray(labelIds)) {
      return res.status(400).json({ error: 'labelIds must be an array' });
    }

    // Delete existing labels
    await query('DELETE FROM library_labels WHERE library_id = $1', [req.params.id]);

    // Insert new labels
    for (const labelId of labelIds) {
      await query(
        'INSERT INTO library_labels (library_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, labelId]
      );
    }

    res.json({ message: 'Labels updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get library rules
 */
router.get('/:id/rules', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM library_custom_rules WHERE library_id = $1 ORDER BY priority DESC, created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create library rule
 */
router.post('/:id/rules', async (req, res) => {
  try {
    const { name, description, rule_json, media_type, priority, enabled } = req.body;

    const result = await query(`
      INSERT INTO library_custom_rules (library_id, name, description, rule_json, media_type, priority, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [req.params.id, name, description, JSON.stringify(rule_json), media_type, priority || 0, enabled !== false]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update library rule
 */
router.put('/:id/rules/:ruleId', async (req, res) => {
  try {
    const { name, description, rule_json, media_type, priority, enabled } = req.body;

    const result = await query(`
      UPDATE library_custom_rules 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          rule_json = COALESCE($3, rule_json),
          media_type = COALESCE($4, media_type),
          priority = COALESCE($5, priority),
          enabled = COALESCE($6, enabled),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND library_id = $8
      RETURNING *
    `, [name, description, rule_json ? JSON.stringify(rule_json) : null, media_type, priority, enabled, req.params.ruleId, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete library rule
 */
router.delete('/:id/rules/:ruleId', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM library_custom_rules WHERE id = $1 AND library_id = $2 RETURNING *',
      [req.params.ruleId, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json({ message: 'Rule deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Radarr config for library
 */
router.get('/:id/radarr', async (req, res) => {
  try {
    const result = await query('SELECT * FROM radarr_config WHERE library_id = $1', [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Set Radarr config for library
 */
router.post('/:id/radarr', async (req, res) => {
  try {
    const { url, api_key, quality_profile_id, root_folder_path, tag, enabled } = req.body;

    const result = await query(`
      INSERT INTO radarr_config (library_id, url, api_key, quality_profile_id, root_folder_path, tag, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (library_id) DO UPDATE SET
        url = $2, api_key = $3, quality_profile_id = $4, root_folder_path = $5, tag = $6, enabled = $7, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [req.params.id, url, api_key, quality_profile_id, root_folder_path, tag, enabled !== false]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get Sonarr config for library
 */
router.get('/:id/sonarr', async (req, res) => {
  try {
    const result = await query('SELECT * FROM sonarr_config WHERE library_id = $1', [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Set Sonarr config for library
 */
router.post('/:id/sonarr', async (req, res) => {
  try {
    const { url, api_key, quality_profile_id, root_folder_path, tag, enabled } = req.body;

    const result = await query(`
      INSERT INTO sonarr_config (library_id, url, api_key, quality_profile_id, root_folder_path, tag, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (library_id) DO UPDATE SET
        url = $2, api_key = $3, quality_profile_id = $4, root_folder_path = $5, tag = $6, enabled = $7, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [req.params.id, url, api_key, quality_profile_id, root_folder_path, tag, enabled !== false]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
