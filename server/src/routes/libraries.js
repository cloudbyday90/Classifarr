const express = require('express');
const db = require('../config/database');
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
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
    const result = await db.query('SELECT * FROM libraries WHERE id = $1', [id]);
    
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

module.exports = router;
