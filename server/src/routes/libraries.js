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
const ollamaService = require('../services/ollama');
const mediaPatternAnalyzer = require('../services/mediaPatternAnalyzer');
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
 * /api/libraries/pending-suggestions:
 *   get:
 *     summary: Get all libraries with pending pattern suggestions
 *     description: Used by dashboard widget to show libraries needing attention
 */
router.get('/pending-suggestions', async (req, res) => {
  try {
    const query = `
      SELECT 
        lps.library_id,
        l.name as library_name,
        lps.pending_count,
        lps.detected_patterns,
        lps.last_analyzed
      FROM library_pattern_suggestions lps
      INNER JOIN libraries l ON l.id = lps.library_id
      WHERE lps.pending_count > 0 
        AND lps.notification_dismissed = false
      ORDER BY lps.pending_count DESC
    `;

    const result = await db.query(query);

    res.json({
      totalPending: result.rows.reduce((sum, r) => sum + r.pending_count, 0),
      libraries: result.rows
    });
  } catch (error) {
    logger.error('Failed to get pending suggestions', { error: error.message });
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
    const { name, priority, arr_type, arr_id, root_folder, quality_profile_id, is_active, event_detection_type } = req.body;

    const result = await db.query(
      `UPDATE libraries 
       SET name = COALESCE($1, name),
           priority = COALESCE($2, priority),
           arr_type = COALESCE($3, arr_type),
           arr_id = COALESCE($4, arr_id),
           root_folder = COALESCE($5, root_folder),
           quality_profile_id = COALESCE($6, quality_profile_id),
           is_active = COALESCE($7, is_active),
           event_detection_type = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [name, priority, arr_type, arr_id, root_folder, quality_profile_id, is_active, event_detection_type, id]
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

// NOTE: Legacy library_custom_rules handlers removed - now using unified library_rules_v2 table
// See handlers at lines ~565-700 for unified GET/POST/PUT/DELETE endpoints

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

    // Fetch from unified table
    const result = await db.query(
      `SELECT * FROM library_rules_v2 
       WHERE library_id = $1 
       ORDER BY priority ASC, created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to get library rules', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/rules:
 *   post:
 *     summary: Add a new rule to a library (unified format)
 */
router.post('/:id/rules', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, conditions, is_active = true, priority = 0 } = req.body;

    // Support legacy format: convert simple rule to conditions array
    let conditionsArray = conditions;
    if (!conditions && req.body.rule_type) {
      conditionsArray = [{
        field: req.body.rule_type,
        operator: req.body.operator,
        value: req.body.value
      }];
    }

    if (!conditionsArray || !Array.isArray(conditionsArray) || conditionsArray.length === 0) {
      return res.status(400).json({ error: 'conditions array is required' });
    }

    // Auto-generate name if not provided
    const ruleName = name || conditionsArray.map(c => `${c.field} ${c.operator} ${c.value}`).join(' AND ');

    const result = await db.query(
      `INSERT INTO library_rules_v2 (library_id, name, description, conditions, is_active, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, ruleName, description, JSON.stringify(conditionsArray), is_active, priority]
    );

    logger.info('Library rule created', { libraryId: id, name: ruleName });
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
    const { name, description, conditions, is_active, priority } = req.body;

    const result = await db.query(
      `UPDATE library_rules_v2 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           conditions = COALESCE($3, conditions),
           is_active = COALESCE($4, is_active),
           priority = COALESCE($5, priority),
           updated_at = NOW()
       WHERE id = $6 AND library_id = $7
       RETURNING *`,
      [name, description, conditions ? JSON.stringify(conditions) : null, is_active, priority, ruleId, id]
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
      `DELETE FROM library_rules_v2 WHERE id = $1 AND library_id = $2 RETURNING id`,
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
 * @swagger
 * /api/libraries/{id}/rules/smart-suggest:
 *   get:
 *     summary: Get LLM-powered smart suggestions based on comprehensive library analysis
 */
router.get('/:id/rules/smart-suggest', async (req, res) => {
  try {
    const { id } = req.params;

    // Get library info
    const libraryResult = await db.query('SELECT * FROM libraries WHERE id = $1', [id]);
    if (libraryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library not found' });
    }
    const library = libraryResult.rows[0];

    // 1. Get AI content_analysis type distribution
    const contentTypeResult = await db.query(`
      SELECT 
        metadata->'content_analysis'->>'type' as content_type,
        COUNT(*) as count
      FROM media_server_items 
      WHERE library_id = $1 AND metadata->'content_analysis' IS NOT NULL
      GROUP BY content_type
      ORDER BY count DESC
      LIMIT 10
    `, [id]);

    // 2. Get genre frequency distribution
    const genreResult = await db.query(`
      SELECT unnest(genres) as genre, COUNT(*) as count
      FROM media_server_items
      WHERE library_id = $1 AND genres IS NOT NULL
      GROUP BY genre
      ORDER BY count DESC
      LIMIT 10
    `, [id]);

    // 3. Get rating distribution
    const ratingResult = await db.query(`
      SELECT content_rating, COUNT(*) as count
      FROM media_server_items
      WHERE library_id = $1 AND content_rating IS NOT NULL
      GROUP BY content_rating
      ORDER BY count DESC
    `, [id]);

    // 4. Get language distribution
    const languageResult = await db.query(`
      SELECT metadata->>'original_language' as language, COUNT(*) as count
      FROM media_server_items
      WHERE library_id = $1 AND metadata->>'original_language' IS NOT NULL
      GROUP BY language
      ORDER BY count DESC
      LIMIT 5
    `, [id]);

    // 5. Get keyword/tag frequency distribution
    const keywordResult = await db.query(`
      SELECT unnest(tags) as keyword, COUNT(*) as count
      FROM media_server_items
      WHERE library_id = $1 AND tags IS NOT NULL AND array_length(tags, 1) > 0
      GROUP BY keyword
      ORDER BY count DESC
      LIMIT 20
    `, [id]);

    // 6. Get total items and analyzed/enriched counts
    const countResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE metadata->'content_analysis' IS NOT NULL) as analyzed,
        COUNT(*) FILTER (WHERE metadata->'tavily_imdb' IS NOT NULL OR metadata->'tavily_advisory' IS NOT NULL) as tavily_enriched
      FROM media_server_items
      WHERE library_id = $1
    `, [id]);

    // 7. Get sample Tavily insights (aggregate from enriched items)
    const tavilyInsightsResult = await db.query(`
      SELECT 
        metadata->'tavily_advisory'->>'answer' as advisory_insight,
        metadata->'tavily_imdb'->>'answer' as imdb_insight,
        metadata->'tavily_anime'->>'answer' as anime_insight
      FROM media_server_items
      WHERE library_id = $1 
        AND (metadata->'tavily_advisory' IS NOT NULL OR metadata->'tavily_imdb' IS NOT NULL)
      LIMIT 5
    `, [id]);

    // Collect unique insights from Tavily enrichment
    const tavilyInsights = tavilyInsightsResult.rows
      .flatMap(r => [r.advisory_insight, r.imdb_insight, r.anime_insight])
      .filter(Boolean)
      .slice(0, 3);

    // 8. Get existing rules for this library (to avoid duplicate suggestions)
    const existingRulesResult = await db.query(
      `SELECT name, conditions FROM library_rules_v2 WHERE library_id = $1`,
      [id]
    );
    const existingRules = existingRulesResult.rows;

    const stats = {
      libraryName: library.name,
      mediaType: library.media_type,
      totalItems: parseInt(countResult.rows[0]?.total) || 0,
      analyzedItems: parseInt(countResult.rows[0]?.analyzed) || 0,
      tavilyEnrichedItems: parseInt(countResult.rows[0]?.tavily_enriched) || 0,
      contentTypes: contentTypeResult.rows.map(r => ({ type: r.content_type, count: parseInt(r.count) })),
      genres: genreResult.rows.map(r => ({ genre: r.genre, count: parseInt(r.count) })),
      ratings: ratingResult.rows.map(r => ({ rating: r.content_rating, count: parseInt(r.count) })),
      languages: languageResult.rows.map(r => ({ language: r.language, count: parseInt(r.count) })),
      keywords: keywordResult.rows.map(r => ({ keyword: r.keyword, count: parseInt(r.count) })),
      tavilyInsights
    };

    // 9. Build prompt for Ollama
    const existingRulesSection = existingRules.length > 0
      ? `\nEXISTING RULES (DO NOT SUGGEST DUPLICATES OF THESE):
${existingRules.map(r => `- "${r.name}": ${JSON.stringify(r.conditions)}`).join('\n')}
`
      : '';

    const prompt = `You are an AI assistant helping to create classification rules for a media library.

Library Name: "${stats.libraryName}"
Media Type: ${stats.mediaType}
Total Items: ${stats.totalItems}, Analyzed: ${stats.analyzedItems}, Web-Enriched: ${stats.tavilyEnrichedItems}
${existingRulesSection}

Content Types (from AI analysis):
${stats.contentTypes.map(t => `- ${t.type}: ${t.count} items`).join('\n') || 'No AI analysis available yet'}

Genres:
${stats.genres.map(g => `- ${g.genre}: ${g.count} items`).join('\n') || 'No genre data'}

Content Ratings:
${stats.ratings.map(r => `- ${r.rating}: ${r.count} items`).join('\n') || 'No rating data'}

Languages:
${stats.languages.map(l => `- ${l.language}: ${l.count} items`).join('\n') || 'No language data'}

Keywords/Tags:
${stats.keywords.slice(0, 10).map(k => `- ${k.keyword}: ${k.count} items`).join('\n') || 'No keyword data'}

${stats.tavilyInsights.length > 0 ? `Web Search Insights (from IMDB/content advisories):
${stats.tavilyInsights.map(insight => `- ${insight}`).join('\n')}

` : ''}Based on the library name and this data, suggest 2-4 classification rules that would best define what content belongs in this library. For each rule, provide:
1. A descriptive name
2. The conditions (field, operator, value)
3. A confidence score (0-100) based on how well the data supports this rule
4. Brief reasoning

IMPORTANT: Do NOT suggest rules that duplicate or closely match any existing rules listed above. You may suggest enhancements or variations that add value, but not identical or near-identical rules.

Respond in this exact JSON format:
{"suggestions": [{"name": "Rule Name", "conditions": [{"field": "genre", "operator": "contains", "value": "Horror"}], "confidence": 85, "reasoning": "Brief explanation"}]}

Valid fields: genre, content_type, rating, language, keyword
Valid operators: equals, contains, includes`;

    // 7. Get Ollama config and generate suggestions
    let llmSuggestions = [];
    try {
      const configResult = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
      if (configResult.rows.length > 0) {
        const config = configResult.rows[0];
        const response = await ollamaService.generate(prompt, config.model, parseFloat(config.temperature) || 0.3);

        // Parse JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          llmSuggestions = parsed.suggestions || [];

          // Filter out any suggestions that duplicate existing rules (backup check)
          if (existingRules.length > 0) {
            llmSuggestions = llmSuggestions.filter(suggestion => {
              // Check if any condition in the suggestion matches an existing rule
              return !existingRules.some(existingRule => {
                const existingConditions = existingRule.conditions || [];
                const suggestedConditions = suggestion.conditions || [];

                // Check for overlap - if any condition field+value matches
                return suggestedConditions.some(sc =>
                  existingConditions.some(ec =>
                    ec.field === sc.field &&
                    String(ec.value).toLowerCase() === String(sc.value).toLowerCase()
                  )
                );
              });
            });
          }
        }
      }
    } catch (llmError) {
      logger.warn('LLM suggestion generation failed', { error: llmError.message });
      // Continue with data-only suggestions
    }

    // 8. Build fallback suggestions from data if LLM failed or no config
    const dataSuggestions = [];

    // Top content type suggestion
    if (stats.contentTypes.length > 0) {
      const top = stats.contentTypes[0];
      const confidence = Math.round((top.count / stats.totalItems) * 100);
      dataSuggestions.push({
        name: `${top.type} Content`,
        conditions: [{ field: 'content_type', operator: 'equals', value: top.type }],
        confidence,
        reasoning: `${confidence}% of analyzed items are ${top.type}`
      });
    }

    // Top genre suggestion
    if (stats.genres.length > 0) {
      const top = stats.genres[0];
      const confidence = Math.round((top.count / stats.totalItems) * 100);
      dataSuggestions.push({
        name: `${top.genre} Genre`,
        conditions: [{ field: 'genre', operator: 'contains', value: top.genre }],
        confidence,
        reasoning: `${confidence}% of items have ${top.genre} genre`
      });
    }

    // Rating suggestion if consistent
    if (stats.ratings.length > 0 && stats.ratings.length <= 3) {
      const topRatings = stats.ratings.slice(0, 2).map(r => r.rating);
      const totalCount = stats.ratings.slice(0, 2).reduce((sum, r) => sum + r.count, 0);
      const confidence = Math.round((totalCount / stats.totalItems) * 100);
      dataSuggestions.push({
        name: `${topRatings.join('/')} Rated Content`,
        conditions: [{ field: 'rating', operator: 'includes', value: topRatings.join(',') }],
        confidence,
        reasoning: `${confidence}% of items are ${topRatings.join(' or ')} rated`
      });
    }

    // Language suggestion - particularly for non-English dominant libraries
    if (stats.languages.length > 0) {
      const top = stats.languages[0];
      const confidence = Math.round((top.count / stats.totalItems) * 100);
      // Only suggest if language is dominant (>50%) and not English (which is default)
      if (confidence >= 50 && top.language !== 'en') {
        const languageNames = {
          'ja': 'Japanese',
          'ko': 'Korean',
          'zh': 'Chinese',
          'es': 'Spanish',
          'fr': 'French',
          'de': 'German',
          'it': 'Italian',
          'pt': 'Portuguese',
          'ru': 'Russian',
          'hi': 'Hindi'
        };
        const langName = languageNames[top.language] || top.language.toUpperCase();
        dataSuggestions.push({
          name: `${langName} Language Content`,
          conditions: [{ field: 'language', operator: 'equals', value: top.language }],
          confidence,
          reasoning: `${confidence}% of items are in ${langName}`
        });
      }
    }

    // Top keyword suggestions - if significant keywords exist
    if (stats.keywords.length > 0) {
      const topKeywords = stats.keywords.slice(0, 3); // Top 3 keywords
      for (const kw of topKeywords) {
        const confidence = Math.round((kw.count / stats.totalItems) * 100);
        // Only suggest if keyword is in at least 20% of items
        if (confidence >= 20) {
          dataSuggestions.push({
            name: `${kw.keyword.charAt(0).toUpperCase() + kw.keyword.slice(1)} Keyword`,
            conditions: [{ field: 'keyword', operator: 'contains', value: kw.keyword }],
            confidence,
            reasoning: `${confidence}% of items have keyword "${kw.keyword}"`
          });
        }
      }
    }

    // Kids-friendly content detection based on ratings
    const kidsRatings = ['G', 'PG', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG'];
    const kidsRatingCounts = stats.ratings.filter(r => kidsRatings.includes(r.rating));
    if (kidsRatingCounts.length > 0) {
      const kidsTotal = kidsRatingCounts.reduce((sum, r) => sum + r.count, 0);
      const kidsConfidence = Math.round((kidsTotal / stats.totalItems) * 100);
      // If 70%+ is kids-friendly content
      if (kidsConfidence >= 70) {
        dataSuggestions.push({
          name: 'Kids-Friendly Content',
          conditions: [{ field: 'rating', operator: 'includes', value: kidsRatings.join(',') }],
          confidence: kidsConfidence,
          reasoning: `${kidsConfidence}% of items have kids-friendly ratings (${kidsRatingCounts.map(r => r.rating).join(', ')})`
        });
      }
    }

    // Anime detection - Japanese language + Animation genre + library name hints
    const libraryLower = stats.libraryName.toLowerCase();
    const hasAnimeInName = libraryLower.includes('anime');
    const hasJapanese = stats.languages.some(l => l.language === 'ja');
    const hasAnimation = stats.genres.some(g => g.genre === 'Animation' || g.genre.toLowerCase().includes('anime'));

    if (hasAnimeInName || (hasJapanese && hasAnimation)) {
      const japaneseCount = stats.languages.find(l => l.language === 'ja')?.count || 0;
      const animationCount = stats.genres.find(g => g.genre === 'Animation')?.count || 0;
      const combinedConfidence = Math.round(Math.max(
        (japaneseCount / stats.totalItems) * 100,
        (animationCount / stats.totalItems) * 100,
        hasAnimeInName ? 90 : 0 // High confidence if "anime" is in library name
      ));

      if (combinedConfidence >= 50) {
        dataSuggestions.push({
          name: 'Anime Content',
          conditions: [
            { field: 'language', operator: 'equals', value: 'ja' },
            { field: 'genre', operator: 'contains', value: 'Animation' }
          ],
          confidence: combinedConfidence,
          reasoning: `Library appears to be for Anime content (${hasAnimeInName ? 'name indicates anime' : 'Japanese animation detected'})`
        });
      }
    }

    res.json({
      stats,
      suggestions: llmSuggestions.length > 0 ? llmSuggestions : dataSuggestions,
      source: llmSuggestions.length > 0 ? 'llm' : 'data-analysis'
    });
  } catch (error) {
    logger.error('Failed to generate smart suggestions', { error: error.message });
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

/**
 * @swagger
 * /api/libraries/{id}/rule-suggestions/{contentType}:
 *   get:
 *     summary: Get Plex-based pattern suggestions for content type
 *     description: Analyzes detected content group to extract common Plex metadata patterns (100% confidence)
 */
router.get('/:id/rule-suggestions/:contentType', async (req, res) => {
  try {
    const { id, contentType } = req.params;

    logger.info('Fetching media server pattern suggestions', { libraryId: id, contentType });

    const result = await mediaPatternAnalyzer.analyzeGroup(parseInt(id), contentType);

    res.json(result);
  } catch (error) {
    logger.error('Failed to get pattern suggestions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/available-patterns:
 *   get:
 *     summary: Get available patterns from library media server metadata
 *     description: Analyzes ALL items in library to extract available filter patterns (ratings, genres, collections, labels, studios, years)
 */
router.get('/:id/available-patterns', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Fetching available patterns from library metadata', { libraryId: id });

    const result = await mediaPatternAnalyzer.analyzeLibrary(parseInt(id));

    res.json(result);
  } catch (error) {
    logger.error('Failed to get available patterns', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/dismiss-suggestions:
 *   post:
 *     summary: Dismiss pending suggestions for a library
 */
router.post('/:id/dismiss-suggestions', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `UPDATE library_pattern_suggestions 
       SET notification_dismissed = true, updated_at = NOW() 
       WHERE library_id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to dismiss suggestions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/refresh-patterns:
 *   post:
 *     summary: Trigger pattern re-analysis for a library
 */
router.post('/:id/refresh-patterns', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Refreshing patterns for library', { libraryId: id });

    const result = await mediaPatternAnalyzer.analyzeLibrary(parseInt(id));

    // Update the library_pattern_suggestions table
    await db.query(
      `INSERT INTO library_pattern_suggestions (library_id, detected_patterns, pending_count, last_analyzed, notification_dismissed, updated_at)
       VALUES ($1, $2, $3, NOW(), false, NOW())
       ON CONFLICT (library_id) 
       DO UPDATE SET 
         detected_patterns = $2, 
         pending_count = $3, 
         last_analyzed = NOW(),
         notification_dismissed = false,
         updated_at = NOW()`,
      [id, JSON.stringify(result.patterns), result.patterns.length]
    );

    res.json(result);
  } catch (error) {
    logger.error('Failed to refresh patterns', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/dismissed-patterns:
 *   get:
 *     summary: Get dismissed patterns for a library
 */
router.get('/:id/dismissed-patterns', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, pattern_type, pattern_value, dismissed_at 
       FROM dismissed_patterns 
       WHERE library_id = $1 
       ORDER BY dismissed_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to get dismissed patterns', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/dismiss-pattern:
 *   post:
 *     summary: Dismiss a specific pattern suggestion
 */
router.post('/:id/dismiss-pattern', async (req, res) => {
  try {
    const { id } = req.params;
    const { patternType, patternValue } = req.body;

    if (!patternType || !patternValue) {
      return res.status(400).json({ error: 'patternType and patternValue are required' });
    }

    await db.query(
      `INSERT INTO dismissed_patterns (library_id, pattern_type, pattern_value)
       VALUES ($1, $2, $3)
       ON CONFLICT (library_id, pattern_type, pattern_value) DO NOTHING`,
      [id, patternType, patternValue]
    );

    // Update pending count in library_pattern_suggestions
    await db.query(
      `UPDATE library_pattern_suggestions 
       SET pending_count = GREATEST(pending_count - 1, 0), updated_at = NOW()
       WHERE library_id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Pattern dismissed' });
  } catch (error) {
    logger.error('Failed to dismiss pattern', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/libraries/{id}/restore-pattern:
 *   post:
 *     summary: Restore a previously dismissed pattern
 */
router.post('/:id/restore-pattern', async (req, res) => {
  try {
    const { id } = req.params;
    const { patternType, patternValue } = req.body;

    if (!patternType || !patternValue) {
      return res.status(400).json({ error: 'patternType and patternValue are required' });
    }

    await db.query(
      `DELETE FROM dismissed_patterns 
       WHERE library_id = $1 AND pattern_type = $2 AND pattern_value = $3`,
      [id, patternType, patternValue]
    );

    // Update pending count in library_pattern_suggestions
    await db.query(
      `UPDATE library_pattern_suggestions 
       SET pending_count = pending_count + 1, updated_at = NOW()
       WHERE library_id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Pattern restored' });
  } catch (error) {
    logger.error('Failed to restore pattern', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

