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

import { respondToPrompt } from '../services/promptResponseService.mjs';
import { projectPromptClassification } from '../services/promptClassificationProjection.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import { requireValidId } from './routeHelpers.mjs';
import { NotFoundError } from '../utils/appError.mjs';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;
const DEFAULT_BATCH_LIMIT = 50;
const DEFAULT_OFFSET = 0;

export function createPromptsRouter({ express, db, promptBuilder, feedbackAnalysis }) {
  const router = express.Router();

  router.get('/batch', asyncHandler(async (req, res) => {
    const limit = parseIntParam(req.query.limit, DEFAULT_BATCH_LIMIT, 1, MAX_LIMIT);

    const result = await db.query(
      `
          SELECT 
              ch.id,
              ch.tmdb_id,
              ch.media_type,
              ch.title,
              ch.year,
              ch.metadata,
              ch.confidence,
              ch.created_at AT TIME ZONE 'UTC' AS created_at
          FROM classification_history ch
          WHERE ch.status = 'pending'
          ORDER BY ch.created_at DESC
          LIMIT $1
        `,
      [limit]
    );

    const items = result.rows.map((item) => {
      const { metadata, evaluation: evaluationResult } = projectPromptClassification(item);

      return {
        id: item.id,
        title: item.title,
        year: item.year,
        media_type: item.media_type,
        metadata,
        evaluation: evaluationResult,
      };
    });

    const batchSummary = promptBuilder.buildBatchSummary(items);

    return res.json({
      success: true,
      data: batchSummary,
    });
  }));

  router.get('/pending', asyncHandler(async (req, res) => {
    const limit = parseIntParam(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = parseIntParam(req.query.offset, DEFAULT_OFFSET, 0);

    const result = await db.query(
      `
          SELECT 
              ch.id,
              ch.tmdb_id,
              ch.media_type,
              ch.title,
              ch.year,
              ch.metadata,
              ch.confidence,
              ch.pending_reason,
              ch.created_at AT TIME ZONE 'UTC' AS created_at,
              ch.method AS classification_method
          FROM classification_history ch
          WHERE ch.status = 'pending'
          ORDER BY ch.created_at DESC
          LIMIT $1 OFFSET $2
        `,
      [limit, offset]
    );

    const items = result.rows;

    const countResult = await db.query(
      `
          SELECT COUNT(*) as total
          FROM classification_history
          WHERE status = 'pending'
        `
    );

    const total = Number.parseInt(countResult.rows[0].total, 10);

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + items.length < total,
        },
      },
    });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'prompt ID');

    const result = await db.query(
      `
          SELECT 
              ch.id,
              ch.tmdb_id,
              ch.media_type,
              ch.title,
              ch.year,
              ch.metadata,
              ch.confidence,
              ch.pending_reason,
              ch.created_at AT TIME ZONE 'UTC' AS created_at,
              ch.method AS classification_method
          FROM classification_history ch
          WHERE ch.id = $1
        `,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Prompt not found');
    }

    const item = result.rows[0];
    const { metadata, evaluation: evaluationResult } = projectPromptClassification(item);

    const prompt = await promptBuilder.buildPrompt(
      {
        title: item.title,
        year: item.year,
        media_type: item.media_type,
        tmdb_id: item.tmdb_id,
        ...metadata,
      },
      evaluationResult
    );

    return res.json({
      success: true,
      data: {
        id: item.id,
        prompt,
        createdAt: item.created_at,
      },
    });
  }));

  router.post('/:id/respond', asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'prompt ID');
    const data = await respondToPrompt({ db, feedbackAnalysis, id, body: req.body });
    return res.json({ success: true, data });
  }));

  return router;
}
