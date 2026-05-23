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

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { registerArrConfigRoutes } from './librariesRouteArrConfig.mjs';
import { registerRuleSuggestionRoutes } from './librariesRouteRuleSuggestions.mjs';
import { registerPatternRoutes } from './librariesRoutePatterns.mjs';

export function createLibrariesRouter({
  express,
  db,
  radarrService,
  sonarrService,
  ollamaService,
  mediaPatternAnalyzer,
  libraryProfileService,
  createLogger,
  normalizeMetadataListLower,
  authenticateTokenOrApiKey,
  requireReadWrite,
  mediaSyncService,
  metadataEnrichment,
}) {
  const router = express.Router();
  const logger = createLogger('libraries');

  router.use(authenticateTokenOrApiKey);

  router.get('/', asyncHandler(async (req, res) => {
      const result = await db.query(`
      SELECT
        l.*,
        COALESCE(msi.item_count, 0)::int AS item_count,
        l.item_count::int AS stored_item_count,
        ms.name as media_server_name,
        ms.type as media_server_type
      FROM libraries l
      LEFT JOIN (
        SELECT library_id, COUNT(*)::int AS item_count
        FROM media_server_items
        GROUP BY library_id
      ) msi ON msi.library_id = l.id
      LEFT JOIN media_server ms ON l.media_server_id = ms.id
      ORDER BY l.priority DESC, l.name ASC
    `);
      res.json(result.rows);
  }));

  router.get('/pending-suggestions', asyncHandler(async (req, res) => {
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
        libraries: result.rows,
      });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
      const { id } = req.params;
      const result = await db.query(
        `
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
    `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Library not found' });
      }

      res.json(result.rows[0]);
  }));

  router.put('/:id', requireReadWrite, asyncHandler(async (req, res) => {
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
  }));

  registerArrConfigRoutes(router, { db, radarrService, sonarrService, requireReadWrite, logger });

  router.get('/:id/labels', asyncHandler(async (req, res) => {
      const { id } = req.params;

      const result = await db.query(
        `
      SELECT ll.id, ll.rule_type, lp.id as preset_id, lp.category, lp.name, lp.display_name, lp.description
      FROM library_labels ll
      JOIN label_presets lp ON ll.label_preset_id = lp.id
      WHERE ll.library_id = $1
      ORDER BY lp.category, lp.name
    `,
        [id]
      );

      res.json(result.rows);
  }));

  router.post('/:id/labels', requireReadWrite, asyncHandler(async (req, res) => {
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
  }));

  router.delete('/:id/labels/:labelId', requireReadWrite, asyncHandler(async (req, res) => {
      const { id, labelId } = req.params;

      await db.query('DELETE FROM library_labels WHERE library_id = $1 AND id = $2', [id, labelId]);

      res.json({ success: true });
  }));

  router.get('/label-presets/all', asyncHandler(async (req, res) => {
      const result = await db.query('SELECT * FROM label_presets ORDER BY category, name');
      res.json(result.rows);
  }));

  router.post('/:id/sync', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { incremental = false, batchSize = 100 } = req.body;

      logger.info('Starting library sync', { libraryId: id, incremental });

      const result = await mediaSyncService.syncLibrary(parseInt(id), {
        incremental,
        batchSize,
      });

      res.json(result);
  }));

  router.get('/:id/rules', asyncHandler(async (req, res) => {
      const { id } = req.params;

      const result = await db.query(
        `SELECT * FROM library_rules_v2 
       WHERE library_id = $1 
       ORDER BY priority ASC, created_at DESC`,
        [id]
      );

      res.json(result.rows);
  }));

  router.post('/:id/rules', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { name, description, conditions, is_active = true, priority = 0 } = req.body;

      let conditionsArray = conditions;
      if (!conditions && req.body.rule_type) {
        conditionsArray = [{
          field: req.body.rule_type,
          operator: req.body.operator,
          value: req.body.value,
        }];
      }

      if (!conditionsArray || !Array.isArray(conditionsArray) || conditionsArray.length === 0) {
        return res.status(400).json({ error: 'conditions array is required' });
      }

      const ruleName = name || conditionsArray.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ');

      const result = await db.query(
        `INSERT INTO library_rules_v2 (library_id, name, description, conditions, is_active, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
        [id, ruleName, description, JSON.stringify(conditionsArray), is_active, priority]
      );

      logger.info('Library rule created', { libraryId: id, name: ruleName });
      res.status(201).json(result.rows[0]);
  }));

  router.get('/:id/rules/debug-insert', asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Debug endpoint not available in production',
      });
    }

      const { id } = req.params;
      const result = await db.query(
        `INSERT INTO library_rules (library_id, rule_type, operator, value, is_exception, priority, description)
       VALUES ($1, 'keyword', 'contains', 'debug_test', false, 0, 'Debug Rule')
       RETURNING *`,
        [id]
      );
      res.json(result.rows[0]);
  }));

  router.put('/:id/rules/:ruleId', requireReadWrite, asyncHandler(async (req, res) => {
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
  }));

  router.delete('/:id/rules/:ruleId', requireReadWrite, asyncHandler(async (req, res) => {
      const { id, ruleId } = req.params;

      const result = await db.query(
        `DELETE FROM library_rules_v2 WHERE id = $1 AND library_id = $2 RETURNING id`,
        [ruleId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json({ success: true, deletedId: result.rows[0].id });
  }));

  router.post('/:id/rules/preview', asyncHandler(async (req, res) => {
      const { id } = req.params;
      let { criteria } = req.body;

      if (!criteria) {
        return res.status(400).json({ error: 'criteria is required' });
      }

      let query = 'SELECT * FROM media_server_items WHERE library_id = $1';
      const params = [id];
      let paramIndex = 2;

      if (!Array.isArray(criteria)) {
        criteria = [criteria];
      }

      for (const condition of criteria) {
        const { field, operator, value } = condition;

        if (!value || (Array.isArray(value) && value.length === 0)) {
          continue;
        }

        switch (field) {
          case 'content_type':
            if (operator === 'is_one_of') {
              const types = Array.isArray(value) ? value : [value];
              query += ` AND metadata->'content_analysis'->>'type' = ANY($${paramIndex})`;
              params.push(types);
            } else {
              query += ` AND metadata->'content_analysis'->>'type' = $${paramIndex}`;
              params.push(value);
            }
            paramIndex++;
            break;

          case 'genres':
            if (operator === 'contains') {
              query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = LOWER($${paramIndex}))`;
              params.push(value);
              paramIndex++;
            } else if (operator === 'is_one_of') {
              const genres = Array.isArray(value) ? value : [value];
              query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = ANY(SELECT LOWER(unnest($${paramIndex}::text[]))))`;
              params.push(genres);
              paramIndex++;
            } else if (operator === 'not_contains') {
              query += ` AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = LOWER($${paramIndex}))`;
              params.push(value);
              paramIndex++;
            }
            break;

          case 'keywords':
          case 'tags':
            if (operator === 'contains') {
              query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) AS t WHERE LOWER(t) LIKE LOWER($${paramIndex}))`;
              params.push(`%${value}%`);
              paramIndex++;
            }
            break;

          case 'title':
            if (operator === 'contains') {
              query += ` AND LOWER(title) LIKE LOWER($${paramIndex})`;
              params.push(`%${value}%`);
              paramIndex++;
            }
            break;

          case 'year':
            if (operator === 'equals') {
              query += ` AND year = $${paramIndex}`;
              params.push(parseInt(value));
            } else if (operator === 'greater_than') {
              query += ` AND year > $${paramIndex}`;
              params.push(parseInt(value));
            } else if (operator === 'less_than') {
              query += ` AND year < $${paramIndex}`;
              params.push(parseInt(value));
            } else if (operator === 'between' && value.includes(',')) {
              const [min, max] = value.split(',').map((v) => parseInt(v.trim()));
              query += ` AND year >= $${paramIndex} AND year <= $${paramIndex + 1}`;
              params.push(min, max);
              paramIndex++;
            }
            paramIndex++;
            break;

          case 'certification':
          case 'content_rating':
            if (operator === 'equals') {
              query += ` AND (metadata->>'content_rating' = $${paramIndex} OR metadata->>'certification' = $${paramIndex})`;
              params.push(value);
            } else if (operator === 'is_one_of') {
              const certs = Array.isArray(value) ? value : [value];
              query += ` AND (metadata->>'content_rating' = ANY($${paramIndex}) OR metadata->>'certification' = ANY($${paramIndex}))`;
              params.push(certs);
            }
            paramIndex++;
            break;

          case 'original_language':
            if (operator === 'equals') {
              query += ` AND metadata->>'original_language' = $${paramIndex}`;
              params.push(value);
              paramIndex++;
            } else if (operator === 'is_one_of') {
              const langs = Array.isArray(value) ? value : [value];
              query += ` AND metadata->>'original_language' = ANY($${paramIndex})`;
              params.push(langs);
              paramIndex++;
            }
            break;
        }
      }

      query += ' ORDER BY added_at DESC LIMIT 50';

      const result = await db.query(query, params);
      res.json(result.rows);
  }));

  registerRuleSuggestionRoutes(router, { db, ollamaService, normalizeMetadataListLower, requireReadWrite, metadataEnrichment, logger });

  registerPatternRoutes(router, { db, mediaPatternAnalyzer, requireReadWrite, logger });

  router.get('/:id/profile', asyncHandler(async (req, res) => {
      const { id } = req.params;

      const profile = await libraryProfileService.getProfile(parseInt(id));
      if (!profile) {
        return res.status(404).json({
          error: 'Profile not found',
          message: 'Profile will be generated after library sync and enrichment',
        });
      }

      res.json(profile);
  }));

  router.post('/:id/profile/refresh', requireReadWrite, asyncHandler(async (req, res) => {
      const { id } = req.params;

      logger.info('Refreshing library profile', { libraryId: id });

      const profile = await libraryProfileService.generateProfile(parseInt(id));

      if (!profile) {
        return res.status(400).json({
          error: 'Cannot generate profile',
          message: 'Library has no synced items',
        });
      }

      res.json({ success: true, profile });
  }));

  return router;
}
