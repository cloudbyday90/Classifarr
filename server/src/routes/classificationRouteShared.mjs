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

import { randomUUID } from 'crypto';
import {
  buildOutcomeRateSet,
  createDefaultOutcomeCohorts,
  createEmptyOutcomeTypeBreakdown,
  parseOptionalBoolean,
  parsePositiveIntWithBounds,
  safeParseJsonObject,
  safeParsePolicyQuestion,
} from './classificationRouteHelpers.mjs';

export function createClassificationRouter({
  express,
  db,
  classificationService,
  classificationRetryService,
  classificationOutcomeService,
  clarificationService,
  classificationEvidenceService,
  classificationEvidenceReinforcementService,
  PATTERN_SIGNAL_TYPES,
  createLogger,
  requireReadWrite,
  STALE_AWAITING_DECISION_DAYS,
  reclassificationService,
}) {
  const router = express.Router();
  const logger = createLogger('classification');

  router.reclassificationService = reclassificationService;

  async function getReclassificationService() {
    return router.reclassificationService;
  }

  router.post('/classify', async (req, res) => {
    try {
      const { tmdb_id, media_type, title } = req.body;

      if (!tmdb_id || !media_type) {
        return res.status(400).json({ error: 'tmdb_id and media_type are required' });
      }

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

      const whereConditions = [];
      const params = [];
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
        total = parseInt(result.rows[0].total_count);
      } else {
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
        data: result.rows.map((row) => {
          const { total_count: _totalCount, ...rest } = row;
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

  router.get('/history/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `
      SELECT 
        ch.*, 
        l.name as library_name,
        l.media_type as library_media_type
      FROM classification_history ch
      LEFT JOIN libraries l ON ch.library_id = l.id
      WHERE ch.id = $1
    `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Classification not found' });
      }

      const corrections = await db.query(
        `
      SELECT 
        cc.*,
        l.name as corrected_library_name
      FROM classification_corrections cc
      LEFT JOIN libraries l ON cc.corrected_library_id = l.id
      WHERE cc.classification_id = $1
      ORDER BY cc.created_at DESC
    `,
        [id]
      );

      res.json({
        ...result.rows[0],
        corrections: corrections.rows,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/corrections', async (req, res) => {
    try {
      const { classification_id, corrected_library_id, corrected_by } = req.body;

      if (!classification_id || !corrected_library_id) {
        return res.status(400).json({ error: 'classification_id and corrected_library_id are required' });
      }

      const classResult = await db.query(
        'SELECT library_id, tmdb_id, media_type, metadata FROM classification_history WHERE id = $1',
        [classification_id]
      );

      if (classResult.rows.length === 0) {
        return res.status(404).json({ error: 'Classification not found' });
      }

      const { library_id: original_library_id, tmdb_id, media_type, metadata } = classResult.rows[0];

      await db.query(
        `UPDATE classification_history 
       SET library_id = $1, 
           library_name = (SELECT name FROM libraries WHERE id = $1),
           status = $2 
       WHERE id = $3`,
        [corrected_library_id, 'corrected', classification_id]
      );

      const correctionResult = await db.query(
        `INSERT INTO classification_corrections 
       (classification_id, original_library_id, corrected_library_id, corrected_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
        [classification_id, original_library_id, corrected_library_id, corrected_by || 'user']
      );

      const correctedLibraryLookup = await db.query('SELECT name FROM libraries WHERE id = $1', [corrected_library_id]);
      await classificationOutcomeService.recordOutcome(classification_id, {
        type: 'corrected',
        source: 'api_correction',
        actor: corrected_by || 'user',
        final_library_id: corrected_library_id,
        final_library_name: correctedLibraryLookup.rows[0]?.name || null,
      });

      await classificationEvidenceService.rememberExactMatch({
        tmdbId: tmdb_id,
        mediaType: media_type || 'unknown',
        libraryId: corrected_library_id,
        payload: metadata,
        payloadColumn: 'pattern_data',
        conflictMode: 'do_nothing',
      });

      setImmediate(async () => {
        try {
          const signalsResult = await db.query('SELECT signals_json FROM classification_history WHERE id = $1', [classification_id]);

          if (signalsResult.rows.length > 0 && signalsResult.rows[0].signals_json) {
            const signals = signalsResult.rows[0].signals_json;
            const patternSignals = signals.filter((signal) => signal.type && PATTERN_SIGNAL_TYPES.includes(signal.type));

            if (patternSignals.length > 0) {
              await classificationEvidenceReinforcementService.reinforceOnCorrection(
                classification_id,
                patternSignals,
                corrected_library_id,
                { metadata, mediaType: media_type }
              );
            }
          }
        } catch (error) {
          logger.error('Pattern reinforcement failed for classification', {
            classification_id,
            error: error.message,
          });
        }
      });

      res.json(correctionResult.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/reclassify', async (req, res) => {
    try {
      const { classification_id, target_library_id, corrected_by } = req.body;

      if (!classification_id || !target_library_id) {
        return res.status(400).json({ error: 'classification_id and target_library_id are required' });
      }

      const reclassificationService = await getReclassificationService();
      const result = await reclassificationService.executeReclassification({
        classificationId: classification_id,
        targetLibraryId: target_library_id,
        correctedBy: corrected_by || 'user',
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

  router.post('/reclassify/preview', async (req, res) => {
    try {
      const { classification_id, target_library_id } = req.body;

      if (!classification_id || !target_library_id) {
        return res.status(400).json({ error: 'classification_id and target_library_id are required' });
      }

      const reclassificationService = await getReclassificationService();
      const preview = await reclassificationService.previewReclassification({
        classificationId: classification_id,
        targetLibraryId: target_library_id,
      });

      res.json(preview);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/stats', async (_req, res) => {
    try {
      const totalResult = await db.query("SELECT COUNT(*) as total FROM classification_history WHERE method != 'source_library'");
      const methodResult = await db.query(
        `
      SELECT method, COUNT(*) as count
      FROM classification_history
      GROUP BY method
      ORDER BY count DESC
    `
      );
      const libraryResult = await db.query(
        `
      SELECT l.name, COUNT(*) as count
      FROM classification_history ch
      JOIN libraries l ON ch.library_id = l.id
      GROUP BY l.id, l.name
      ORDER BY count DESC
      LIMIT 10
    `
      );
      const confidenceResult = await db.query(
        `
      SELECT method, AVG(confidence) as avg_confidence
      FROM classification_history
      WHERE confidence IS NOT NULL
      GROUP BY method
    `
      );
      const activityResult = await db.query(
        `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM classification_history
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `
      );

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

      const defaultCohorts = createDefaultOutcomeCohorts();

      for (const row of result.rows) {
        if (!defaultCohorts[row.cohort]) {
          continue;
        }

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
          retried: Number.parseInt(row.first_retried, 10) || 0,
        };
        const rateSet = buildOutcomeRateSet({
          total,
          linkedOutcomes,
          verified,
          corrected,
          resolved,
          retried,
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
            retried,
          },
          perTotal: rateSet.perTotal,
          perLinkedOutcome: rateSet.perLinkedOutcome,
          linkedOutcomeRate: rateSet.perTotal.linkedOutcomeRate,
          correctedRate: rateSet.perLinkedOutcome.correctedRate,
          verifiedRate: rateSet.perLinkedOutcome.verifiedRate,
          resolvedRate: rateSet.perLinkedOutcome.resolvedRate,
          retriedRate: rateSet.perLinkedOutcome.retriedRate,
        };
      }

      const cohorts = [
        defaultCohorts.baseline,
        defaultCohorts.pass2_not_adopted,
        defaultCohorts.pass2_adopted,
      ];
      const totals = cohorts.reduce(
        (acc, cohort) => {
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
        },
        {
          total: 0,
          linkedOutcomes: 0,
          verified: 0,
          corrected: 0,
          resolved: 0,
          retried: 0,
          multiStepOutcomes: 0,
          firstOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
        }
      );

      const totalRateSet = buildOutcomeRateSet(totals);

      res.json({
        windowDays: days,
        totals: {
          ...totals,
          latestOutcomeBreakdown: {
            verified: totals.verified,
            corrected: totals.corrected,
            resolved: totals.resolved,
            retried: totals.retried,
          },
          perTotal: totalRateSet.perTotal,
          perLinkedOutcome: totalRateSet.perLinkedOutcome,
          linkedOutcomeRate: totalRateSet.perTotal.linkedOutcomeRate,
          correctedRate: totalRateSet.perLinkedOutcome.correctedRate,
          verifiedRate: totalRateSet.perLinkedOutcome.verifiedRate,
          resolvedRate: totalRateSet.perLinkedOutcome.resolvedRate,
          retriedRate: totalRateSet.perLinkedOutcome.retriedRate,
        },
        cohorts,
      });
    } catch (error) {
      logger.error('Failed to load second-pass evaluation stats', { error: error.message });
      res.status(500).json({ error: 'Failed to load second-pass evaluation stats' });
    }
  });

  router.get('/live-feed', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;

      const result = await db.query(
        `
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
    `,
        [limit]
      );

      res.json({
        items: result.rows.map((row) => ({
          id: row.id,
          title: row.title,
          mediaType: row.media_type,
          method: row.method,
          confidence: row.confidence,
          library: row.library_name,
          timestamp: row.created_at,
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/pending', async (_req, res) => {
    try {
      const pending = await clarificationService.getPendingClassifications();
      const items = pending.map((item) => ({
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

      const libraryExists = await db.query('SELECT id FROM libraries WHERE id = $1 LIMIT 1', [libraryId]);
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

            if (row.arr_type) {
              const routeResult = await classificationService.routeToArr(parsedMeta, {
                id: row.library_id,
                arr_type: row.arr_type,
                arr_id: row.arr_id,
                radarr_settings: row.radarr_settings,
                sonarr_settings: row.sonarr_settings,
                root_folder: row.root_folder,
                quality_profile_id: row.quality_profile_id,
                name: row.library_name,
              });

              routingReason = routeResult?.reason || null;
              if (routeResult?.routed === true) {
                await db.query('UPDATE classification_history SET status = $1 WHERE id = $2', ['routed', classificationId]);

                wasRouted = true;
                logger.info('Routed after resolution', {
                  classificationId,
                  title: parsedMeta.title,
                  library: row.library_name,
                });
              } else {
                routeError = routeResult?.error ? new Error(routeResult.error) : null;
                logger.warn('Routing skipped after resolution', {
                  classificationId,
                  title: parsedMeta.title,
                  library: row.library_name,
                  reason: routingReason || 'unknown',
                });
              }
            }
          } else {
            logger.warn('No classification/library record found for routing after resolution', {
              classificationId,
              libraryId: result.libraryId,
            });
          }
        } catch (error) {
          routeError = error;
          logger.error('Failed to route after resolution', {
            classificationId,
            error: error.message,
          });
        }
      }

      res.json({
        ...result,
        routed: wasRouted,
        routingError: routeError?.message || null,
        routingReason,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

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
        correlationId,
      });

      res.json({
        success: result.failed === 0,
        ...result,
      });
    } catch (error) {
      if (error?.code === 'VALIDATION_ERROR') {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Failed to retry classifications', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/pending/count', async (_req, res) => {
    try {
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

  router.get('/history/:id/profile', async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query('SELECT profile_snapshot FROM classification_history WHERE id = $1', [id]);
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
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to load profile snapshot' });
    }
  });

  return router;
}
