/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const mediaSyncService = require('../services/mediaSync');
const classificationService = require('../services/classification');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('libraries');

/**
 * @swagger
 * /api/libraries:
 *   get:
 *     summary: Get all libraries
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT l.*, ms.name as media_server_name, ms.type as media_server_type
      FROM libraries l
      LEFT JOIN media_server ms ON l.media_server_id = ms.id
      ORDER BY l.priority DESC, l.name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}:
 *   get:
 *     summary: Get library by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT l.*, 
        (SELECT COUNT(*)::int FROM media_server_items WHERE library_id = l.id) as item_count,
        (
          SELECT json_build_object(
            'status', status,
            'items_processed', items_processed,
            'items_total', items_total
          )
          FROM media_server_sync_status 
          WHERE library_id = l.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as sync_status
      FROM libraries l 
      WHERE l.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}:
 *   put:
 *     summary: Update library configuration
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, priority, arr_type, arr_id, root_folder, quality_profile_id, is_active } = req.body;

    const result = await db.query(
      `UPDATE libraries 
       SET name = COALESCE($1, name),
           priority = COALESCE($2, priority),
           arr_type = COALESCE($3, arr_type),
           arr_id = COALESCE($4, arr_id),
           root_folder = COALESCE($5, root_folder),
           quality_profile_id = COALESCE($6, quality_profile_id),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, priority, arr_type, arr_id, root_folder, quality_profile_id, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/labels:
 *   get:
 *     summary: Get labels assigned to library
 */
router.get('/:id/labels', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT ll.id, ll.rule_type, lp.id as preset_id, lp.category, lp.name, lp.display_name, lp.description
      FROM library_labels ll
      JOIN label_presets lp ON ll.label_preset_id = lp.id
      WHERE ll.library_id = $1
      ORDER BY lp.category, lp.name
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/labels:
 *   post:
 *     summary: Assign label to library
 */
router.post('/:id/labels', async (req, res) => {
  try {
    const { id } = req.params;
    const { label_preset_id, rule_type } = req.body;

    const result = await db.query(
      `INSERT INTO library_labels (library_id, label_preset_id, rule_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (library_id, label_preset_id)
       DO UPDATE SET rule_type = $3
       RETURNING *`,
      [id, label_preset_id, rule_type]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/labels/{labelId}:
 *   delete:
 *     summary: Remove label from library
 */
router.delete('/:id/labels/:labelId', async (req, res) => {
  try {
    const { id, labelId } = req.params;

    await db.query(
      'DELETE FROM library_labels WHERE library_id = $1 AND id = $2',
      [id, labelId]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules:
 *   get:
 *     summary: Get custom rules for library
 */
router.get('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM library_custom_rules WHERE library_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules:
 *   post:
 *     summary: Add custom rule to library
 */
router.post('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, rule_json, is_active } = req.body;

    const result = await db.query(
      `INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name, description, JSON.stringify(rule_json), is_active !== false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules/{ruleId}:
 *   put:
 *     summary: Update custom rule
 */
router.put('/:id/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { name, description, rule_json, is_active } = req.body;

    const result = await db.query(
      `UPDATE library_custom_rules
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           rule_json = COALESCE($3, rule_json),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, description, rule_json ? JSON.stringify(rule_json) : null, is_active, ruleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules/{ruleId}:
 *   delete:
 *     summary: Delete custom rule
 */
router.delete('/:id/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;

    await db.query('DELETE FROM library_custom_rules WHERE id = $1', [ruleId]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/arr-options:
 *   get:
 *     summary: Get ARR options (root folders, quality profiles, tags) for library
 */
router.get('/:id/arr-options', async (req, res) => {
  try {
    const { id } = req.params;

    // Get library to determine media type and arr configuration
    const libraryResult = await db.query('SELECT * FROM libraries WHERE id = $1', [id]);
    if (libraryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    const library = libraryResult.rows[0];
    const options = {};

    if (library.media_type === 'movie' && library.arr_id) {
      // Get Radarr options
      const radarrConfig = await db.query(
        'SELECT * FROM radarr_config WHERE id = $1 AND is_active = true',
        [library.arr_id]
      );

      if (radarrConfig.rows.length > 0) {
        const config = radarrConfig.rows[0];
        try {
          const [rootFolders, qualityProfiles, tags] = await Promise.all([
            radarrService.getRootFolders(config.url, config.api_key),
            radarrService.getQualityProfiles(config.url, config.api_key),
            radarrService.getTags(config.url, config.api_key)
          ]);

          options.rootFolders = rootFolders.map(rf => ({
            id: rf.id,
            path: rf.path,
            freeSpace: rf.freeSpace
          }));
          options.qualityProfiles = qualityProfiles.map(qp => ({
            id: qp.id,
            name: qp.name
          }));
          options.tags = tags;
          options.minimumAvailabilityOptions = radarrService.getMinimumAvailabilityOptions();
        } catch (error) {
          return res.status(500).json({ error: `Failed to fetch Radarr options: ${error.message}` });
        }
      }
    } else if (library.media_type === 'tv' && library.arr_id) {
      // Get Sonarr options
      const sonarrConfig = await db.query(
        'SELECT * FROM sonarr_config WHERE id = $1 AND is_active = true',
        [library.arr_id]
      );

      if (sonarrConfig.rows.length > 0) {
        const config = sonarrConfig.rows[0];
        try {
          const [rootFolders, qualityProfiles, tags] = await Promise.all([
            sonarrService.getRootFolders(config.url, config.api_key),
            sonarrService.getQualityProfiles(config.url, config.api_key),
            sonarrService.getTags(config.url, config.api_key)
          ]);

          options.rootFolders = rootFolders.map(rf => ({
            id: rf.id,
            path: rf.path,
            freeSpace: rf.freeSpace
          }));
          options.qualityProfiles = qualityProfiles.map(qp => ({
            id: qp.id,
            name: qp.name
          }));
          options.tags = tags;
          options.seriesTypeOptions = sonarrService.getSeriesTypeOptions();
          options.seasonMonitoringOptions = sonarrService.getSeasonMonitoringOptions();
        } catch (error) {
          return res.status(500).json({ error: `Failed to fetch Sonarr options: ${error.message}` });
        }
      }
    }

    res.json(options);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/arr-settings:
 *   put:
 *     summary: Update ARR settings for library
 */
router.put('/:id/arr-settings', async (req, res) => {
  try {
    const { id } = req.params;
    const { settings } = req.body;

    // Get library to determine media type
    const libraryResult = await db.query('SELECT media_type FROM libraries WHERE id = $1', [id]);
    if (libraryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    const library = libraryResult.rows[0];

    // Validate media_type to prevent SQL injection
    if (library.media_type !== 'movie' && library.media_type !== 'tv') {
      return res.status(400).json({ error: 'Invalid media type' });
    }

    const settingsField = library.media_type === 'movie' ? 'radarr_settings' : 'sonarr_settings';

    const result = await db.query(
      `UPDATE libraries 
       SET ${settingsField} = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(settings), id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/sync-arr-profiles:
 *   post:
 *     summary: Sync profiles from Radarr/Sonarr to cache table
 */
router.post('/sync-arr-profiles', async (req, res) => {
  try {
    let syncedCount = 0;

    // Sync Radarr profiles
    const radarrConfigs = await db.query('SELECT * FROM radarr_config WHERE is_active = true');
    for (const config of radarrConfigs.rows) {
      try {
        const [rootFolders, qualityProfiles, tags] = await Promise.all([
          radarrService.getRootFolders(config.url, config.api_key),
          radarrService.getQualityProfiles(config.url, config.api_key),
          radarrService.getTags(config.url, config.api_key)
        ]);

        // Insert root folders
        for (const rf of rootFolders) {
          await db.query(
            `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_path, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_path = $5, profile_data = $6, last_synced = NOW()`,
            ['radarr', 'root_folder', rf.id, rf.path, rf.path, JSON.stringify(rf)]
          );
          syncedCount++;
        }

        // Insert quality profiles
        for (const qp of qualityProfiles) {
          await db.query(
            `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
            ['radarr', 'quality_profile', qp.id, qp.name, JSON.stringify(qp)]
          );
          syncedCount++;
        }

        // Insert tags
        for (const tag of tags) {
          await db.query(
            `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
            ['radarr', 'tag', tag.id, tag.label, JSON.stringify(tag)]
          );
          syncedCount++;
        }
      } catch (error) {
        logger.error(`Failed to sync Radarr config ${config.id}`, { error: error.message });
      }
    }

    // Sync Sonarr profiles
    const sonarrConfigs = await db.query('SELECT * FROM sonarr_config WHERE is_active = true');
    for (const config of sonarrConfigs.rows) {
      try {
        const [rootFolders, qualityProfiles, tags] = await Promise.all([
          sonarrService.getRootFolders(config.url, config.api_key),
          sonarrService.getQualityProfiles(config.url, config.api_key),
          sonarrService.getTags(config.url, config.api_key)
        ]);

        // Insert root folders
        for (const rf of rootFolders) {
          await db.query(
            `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_path, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_path = $5, profile_data = $6, last_synced = NOW()`,
            ['sonarr', 'root_folder', rf.id, rf.path, rf.path, JSON.stringify(rf)]
          );
          syncedCount++;
        }

        // Insert quality profiles
        for (const qp of qualityProfiles) {
          await db.query(
            `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
            ['sonarr', 'quality_profile', qp.id, qp.name, JSON.stringify(qp)]
          );
          syncedCount++;
        }

        // Insert tags
        for (const tag of tags) {
          await db.query(
            `INSERT INTO arr_profiles_cache (arr_type, profile_type, profile_id, profile_name, profile_data, last_synced)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (arr_type, profile_type, profile_id) 
             DO UPDATE SET profile_name = $4, profile_data = $5, last_synced = NOW()`,
            ['sonarr', 'tag', tag.id, tag.label, JSON.stringify(tag)]
          );
          syncedCount++;
        }
      } catch (error) {
        logger.error(`Failed to sync Sonarr config ${config.id}`, { error: error.message });
      }
    }

    res.json({ success: true, synced: syncedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/label-presets:
 *   get:
 *     summary: Get all available label presets
 */
router.get('/label-presets/all', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM label_presets ORDER BY category, name'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/sync:
 *   post:
 *     summary: Trigger library sync
 */
router.post('/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    const { incremental = false, batchSize = 100 } = req.body;

    logger.info('Starting library sync', { libraryId: id, incremental });

    const result = await mediaSyncService.syncLibrary(parseInt(id), {
      incremental,
      batchSize,
    });

    res.json(result);
  } catch (error) {
    logger.error('Sync failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==========================================
// Library Rules CRUD
// ==========================================

/**
 * @swagger
 * /api/libraries/{id}/rules:
 *   get:
 *     summary: Get all rules for a library
 */
router.get('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch simple rules
    const simpleRules = await db.query(
      `SELECT *, 'simple' as kind FROM library_rules 
       WHERE library_id = $1 
       ORDER BY is_exception DESC, priority ASC`,
      [id]
    );

    // Fetch custom rules
    // Check if table exists first to avoid error during migration race? No, we trust migration works.
    // If table missing, query throws. I'll wrap in try-catch-softly logic or assume migration runs.
    let customRules = { rows: [] };
    try {
      customRules = await db.query(
        `SELECT *, 'custom' as kind FROM library_custom_rules 
           WHERE library_id = $1 
           ORDER BY created_at DESC`,
        [id]
      );
    } catch (e) {
      // Table might not exist yet if migration failed or didn't run. Ignore.
      logger.warn('Could not fetch custom rules (table might be missing)', { error: e.message });
    }

    res.json([...simpleRules.rows, ...customRules.rows]);
  } catch (error) {
    logger.error('Failed to get library rules', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules:
 *   post:
 *     summary: Add a new rule to a library (simple or custom)
 */
router.post('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] POST /${id}/rules Body:`, JSON.stringify(req.body, null, 2));
    const { rule_type, operator, value, is_exception = false, priority = 0, description, rule_json, name, is_active } = req.body;

    // Handle Custom Rule (from Rule Builder)
    if (rule_json) {
      if (!name) return res.status(400).json({ error: 'name is required for custom rules' });

      const result = await db.query(
        `INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
        [id, name, description, JSON.stringify(rule_json), is_active !== false]
      );
      logger.info('Custom library rule created', { libraryId: id, name });
      return res.status(201).json(result.rows[0]);
    }

    // Handle Simple Rule (from Learn suggestions)
    if (!rule_type || !operator || !value) {
      return res.status(400).json({ error: 'rule_type, operator, and value are required (or provide rule_json)' });
    }

    const result = await db.query(
      `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, rule_type, operator, value, is_exception, priority, description]
    );

    logger.info('Library rule created', { libraryId: id, ruleType: rule_type });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to create library rule', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// DEBUG ENDPOINT
router.get('/:id/rules/debug-insert', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
       VALUES ($1, 'keyword', 'contains', 'debug_test', false, 0, 'Debug Rule')
       RETURNING *`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message, detail: error.detail });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules/{ruleId}:
 *   put:
 *     summary: Update a library rule
 */
router.put('/:id/rules/:ruleId', async (req, res) => {
  try {
    const { id, ruleId } = req.params;
    const { rule_type, operator, value, is_exception, priority, description, is_active } = req.body;

    const result = await db.query(
      `UPDATE library_rules 
       SET rule_type = COALESCE($1, rule_type),
           operator = COALESCE($2, operator),
           value = COALESCE($3, value),
           is_exception = COALESCE($4, is_exception),
           priority = COALESCE($5, priority),
           description = COALESCE($6, description),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $8 AND library_id = $9
       RETURNING *`,
      [rule_type, operator, value, is_exception, priority, description, is_active, ruleId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to update library rule', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules/{ruleId}:
 *   delete:
 *     summary: Delete a library rule
 */
router.delete('/:id/rules/:ruleId', async (req, res) => {
  try {
    const { id, ruleId } = req.params;

    const result = await db.query(
      `DELETE FROM library_rules WHERE id = $1 AND library_id = $2 RETURNING id`,
      [ruleId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ success: true, deletedId: result.rows[0].id });
  } catch (error) {
    logger.error('Failed to delete library rule', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules/suggest:
 *   get:
 *     summary: Suggest rules based on existing library content
 */
router.get('/:id/rules/suggest', async (req, res) => {
  try {
    const { id } = req.params;

    // Analyze existing items to suggest rules
    const analysis = await db.query(`
      SELECT 
        array_agg(DISTINCT content_rating) FILTER (WHERE content_rating IS NOT NULL) as ratings,
        array_agg(DISTINCT g) FILTER (WHERE g IS NOT NULL) as genres,
        array_agg(DISTINCT msi.metadata->>'original_language') FILTER (WHERE msi.metadata->>'original_language' IS NOT NULL) as languages,
        COUNT(*) as total_items
      FROM media_server_items msi
        LEFT JOIN LATERAL UNNEST(msi.genres) as g ON true
      WHERE msi.library_id = $1
    `, [id]);

    // Get existing rules to filter suggestions (prevent 'Failed to apply' for duplicates)
    const existingRulesResult = await db.query('SELECT rule_type, value FROM library_rules WHERE library_id = $1', [id]);
    const existingRules = existingRulesResult.rows;

    const data = analysis.rows[0];
    const suggestions = [];

    // Helper to check if rule exists
    const ruleExists = (type, val) => {
      return existingRules.some(r => r.rule_type === type && (r.value === val || r.value.includes(val)));
    };

    // Suggest rating rules if consistent
    if (data.ratings && data.ratings.length > 0 && data.ratings.length <= 5) {
      const val = data.ratings.join(',');
      if (!ruleExists('rating', val)) {
        suggestions.push({
          rule_type: 'rating',
          operator: 'includes',
          value: val,
          description: `Only ratings: ${data.ratings.join(', ')}`,
          is_exception: false
        });
      }
    }

    // Suggest genre rules if there's a dominant genre
    if (data.genres && data.genres.length > 0) {
      const topGenres = data.genres.slice(0, 5);
      const val = topGenres.join(',');
      if (!ruleExists('genre', val)) {
        suggestions.push({
          rule_type: 'genre',
          operator: 'includes',
          value: val,
          description: `Common genres: ${topGenres.join(', ')}`,
          is_exception: false
        });
      }
    }

    // Suggest language rule if non-English dominant (important for anime detection)
    if (data.languages && data.languages.length === 1 && data.languages[0] !== 'en') {
      const val = data.languages[0];
      if (!ruleExists('language', val)) {
        suggestions.push({
          rule_type: 'language',
          operator: 'equals',
          value: val,
          description: `Only ${val} content${val === 'ja' ? ' (Anime)' : ''}`,
          is_exception: false
        });
      }
    }

    // Analyze titles for keyword patterns (Christmas, Holiday, etc.)
    const keywordAnalysis = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%christmas%' OR LOWER(title) LIKE '%xmas%') as christmas_count,
        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%holiday%') as holiday_count,
        COUNT(*) FILTER (WHERE LOWER(title) LIKE '%hallmark%' OR LOWER(msi.studio) LIKE '%hallmark%') as hallmark_count,
        COUNT(*) as total
      FROM media_server_items msi
      WHERE msi.library_id = $1
    `, [id]);

    const kw = keywordAnalysis.rows[0];
    const total = parseInt(kw.total) || 1;
    const christmasRatio = parseInt(kw.christmas_count) / total;
    const holidayRatio = parseInt(kw.holiday_count) / total;
    const hallmarkRatio = parseInt(kw.hallmark_count) / total;

    // If 30%+ of titles have Christmas keywords, suggest a rule
    if (christmasRatio >= 0.3) {
      const val = 'christmas,xmas,holiday,santa,snowman,elf';
      if (!ruleExists('keyword', val)) {
        suggestions.push({
          rule_type: 'keyword',
          operator: 'contains',
          value: val,
          description: `Christmas/Holiday content (${Math.round(christmasRatio * 100)}% match)`,
          is_exception: false
        });
      }
    } else if (holidayRatio >= 0.3) {
      const val = 'holiday,christmas,seasonal';
      if (!ruleExists('keyword', val)) {
        suggestions.push({
          rule_type: 'keyword',
          operator: 'contains',
          value: val,
          description: `Holiday content (${Math.round(holidayRatio * 100)}% match)`,
          is_exception: false
        });
      }
    }

    // If Hallmark studio is dominant
    if (hallmarkRatio >= 0.3) {
      const val = 'hallmark';
      if (!ruleExists('keyword', val)) {
        suggestions.push({
          rule_type: 'keyword',
          operator: 'contains',
          value: val,
          description: `Hallmark productions (${Math.round(hallmarkRatio * 100)}% match)`,
          is_exception: false
        });
      }
    }

    // Check for Anime patterns - Animation genre + Japanese language OR library name contains anime
    const libraryResult = await db.query('SELECT name FROM libraries WHERE id = $1', [id]);
    const libraryName = libraryResult.rows[0]?.name?.toLowerCase() || '';

    // Check if genres include Animation or Anime
    const hasAnimeGenre = data.genres && (
      data.genres.includes('Animation') ||
      data.genres.includes('Anime') ||
      data.genres.some(g => g && g.toLowerCase().includes('anime'))
    );

    // Detect anime if: (Animation genre AND Japanese language) OR library name contains 'anime'
    const isJapanese = data.languages && data.languages.includes('ja');
    const libraryIsAnime = libraryName.includes('anime');

    if ((hasAnimeGenre && isJapanese) || (hasAnimeGenre && libraryIsAnime)) {
      if (!ruleExists('language', 'ja')) {
        suggestions.push({
          rule_type: 'language',
          operator: 'equals',
          value: 'ja',
          description: 'Japanese Anime content',
          is_exception: false
        });
      }

      const animeVal = 'Animation,Anime';
      if (!ruleExists('genre', animeVal) && !suggestions.find(s => s.rule_type === 'genre' && s.value.includes('Animation'))) {
        suggestions.push({
          rule_type: 'genre',
          operator: 'includes',
          value: animeVal,
          description: 'Anime/Animation content',
          is_exception: false
        });
      }
    }

    res.json({
      totalItems: parseInt(data.total_items) || 0,
      suggestions
    });
  } catch (error) {
    logger.error('Failed to suggest rules', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Auto-generate rules based on library name
 * Called automatically when libraries are synced from Plex
 */
router.post('/:id/rules/auto-generate', async (req, res) => {
  try {
    const { id } = req.params;

    // Get library info
    const libraryResult = await db.query('SELECT * FROM libraries WHERE id = $1', [id]);
    if (libraryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }

    const library = libraryResult.rows[0];
    const libraryName = library.name.toLowerCase();
    const rules = [];

    // Check existing rules to avoid duplicates
    const existingRules = await db.query(
      'SELECT rule_type, value FROM library_rules WHERE library_id = $1',
      [id]
    );
    const existingRuleKeys = new Set(
      existingRules.rows.map(r => `${r.rule_type}:${r.value}`)
    );

    const addRule = (rule) => {
      const key = `${rule.rule_type}:${rule.value}`;
      if (!existingRuleKeys.has(key)) {
        rules.push(rule);
      }
    };

    // Kids/Family library patterns
    if (libraryName.includes('kid') || libraryName.includes('family') || libraryName.includes('child')) {
      addRule({
        rule_type: 'rating',
        operator: 'includes',
        value: 'G,PG,TV-Y,TV-Y7,TV-G,TV-PG',
        description: 'Kids-friendly ratings only',
        is_exception: false,
        priority: 0
      });
    }

    // Christmas/Holiday library patterns
    if (libraryName.includes('christmas') || libraryName.includes('holiday') || libraryName.includes('xmas') || libraryName.includes('hallmark')) {
      addRule({
        rule_type: 'keyword',
        operator: 'contains',
        value: 'christmas,holiday,santa,xmas,hallmark',
        description: 'Holiday/Christmas themed content',
        is_exception: true, // Exception so it overrides rating rules
        priority: 0
      });
    }

    // Anime library patterns
    if (libraryName.includes('anime')) {
      addRule({
        rule_type: 'genre',
        operator: 'includes',
        value: 'animation,anime',
        description: 'Anime/Animation genre',
        is_exception: false,
        priority: 0
      });
      addRule({
        rule_type: 'language',
        operator: 'equals',
        value: 'ja',
        description: 'Japanese language content',
        is_exception: false,
        priority: 1
      });
    }

    // Comedy/Standup library patterns
    if (libraryName.includes('comedy') || libraryName.includes('standup') || libraryName.includes('stand-up')) {
      addRule({
        rule_type: 'genre',
        operator: 'includes',
        value: 'comedy',
        description: 'Comedy genre',
        is_exception: false,
        priority: 0
      });
    }

    // Horror library patterns
    if (libraryName.includes('horror') || libraryName.includes('scary')) {
      addRule({
        rule_type: 'genre',
        operator: 'includes',
        value: 'horror,thriller',
        description: 'Horror/Thriller genre',
        is_exception: false,
        priority: 0
      });
    }

    // Documentary library patterns
    if (libraryName.includes('documentary') || libraryName.includes('doc')) {
      addRule({
        rule_type: 'genre',
        operator: 'includes',
        value: 'documentary',
        description: 'Documentary genre',
        is_exception: false,
        priority: 0
      });
    }

    // Action library patterns
    if (libraryName.includes('action')) {
      addRule({
        rule_type: 'genre',
        operator: 'includes',
        value: 'action,adventure',
        description: 'Action/Adventure genre',
        is_exception: false,
        priority: 0
      });
    }

    // Sci-Fi library patterns
    if (libraryName.includes('sci-fi') || libraryName.includes('scifi') || libraryName.includes('science fiction')) {
      addRule({
        rule_type: 'genre',
        operator: 'includes',
        value: 'science fiction,sci-fi',
        description: 'Science Fiction genre',
        is_exception: false,
        priority: 0
      });
    }

    // Insert generated rules
    let created = 0;
    for (const rule of rules) {
      await db.query(
        `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, rule.rule_type, rule.operator, rule.value, rule.is_exception, rule.priority, rule.description]
      );
      created++;
    }

    logger.info('Auto-generated library rules', { libraryId: id, libraryName: library.name, rulesCreated: created });

    res.json({
      success: true,
      libraryName: library.name,
      rulesCreated: created,
      rules
    });
  } catch (error) {
    logger.error('Failed to auto-generate rules', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Auto-generate rules for ALL libraries based on their names
 */
router.post('/auto-generate-all', async (req, res) => {
  try {
    const libraries = await db.query('SELECT id FROM libraries WHERE is_active = true');
    let totalCreated = 0;

    for (const lib of libraries.rows) {
      // Call the individual auto-generate internally
      const checkExisting = await db.query(
        'SELECT COUNT(*) FROM library_rules WHERE library_id = $1',
        [lib.id]
      );

      // Only auto-generate if no rules exist
      if (parseInt(checkExisting.rows[0].count) === 0) {
        // Trigger auto-generation for this library
        const libraryResult = await db.query('SELECT * FROM libraries WHERE id = $1', [lib.id]);
        if (libraryResult.rows.length > 0) {
          const library = libraryResult.rows[0];
          const libraryName = library.name.toLowerCase();

          // Same logic as above, condensed
          const rules = [];

          if (libraryName.includes('kid') || libraryName.includes('family') || libraryName.includes('child')) {
            rules.push({ rule_type: 'rating', operator: 'includes', value: 'G,PG,TV-Y,TV-Y7,TV-G,TV-PG', description: 'Kids-friendly ratings only', is_exception: false, priority: 0 });
          }
          if (libraryName.includes('christmas') || libraryName.includes('holiday') || libraryName.includes('xmas') || libraryName.includes('hallmark')) {
            rules.push({ rule_type: 'keyword', operator: 'contains', value: 'christmas,holiday,santa,xmas,hallmark', description: 'Holiday/Christmas themed content', is_exception: true, priority: 0 });
          }
          if (libraryName.includes('anime')) {
            rules.push({ rule_type: 'genre', operator: 'includes', value: 'animation,anime', description: 'Anime/Animation genre', is_exception: false, priority: 0 });
            rules.push({ rule_type: 'language', operator: 'equals', value: 'ja', description: 'Japanese language content', is_exception: false, priority: 1 });
          }
          if (libraryName.includes('comedy') || libraryName.includes('standup')) {
            rules.push({ rule_type: 'genre', operator: 'includes', value: 'comedy', description: 'Comedy genre', is_exception: false, priority: 0 });
          }
          if (libraryName.includes('horror')) {
            rules.push({ rule_type: 'genre', operator: 'includes', value: 'horror,thriller', description: 'Horror/Thriller genre', is_exception: false, priority: 0 });
          }
          if (libraryName.includes('documentary') || libraryName.includes('doc')) {
            rules.push({ rule_type: 'genre', operator: 'includes', value: 'documentary', description: 'Documentary genre', is_exception: false, priority: 0 });
          }

          for (const rule of rules) {
            await db.query(
              `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [lib.id, rule.rule_type, rule.operator, rule.value, rule.is_exception, rule.priority, rule.description]
            );
            totalCreated++;
          }
        }
      }
    }

    res.json({ success: true, totalRulesCreated: totalCreated });
  } catch (error) {
    logger.error('Failed to auto-generate all rules', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
