/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess } from '../utils/responseHelpers.mjs';
import { NotFoundError } from '../utils/appError.mjs';

export function createSuggestionsRouter({ express, db, feedbackAnalysis }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    let { status, policyId } = req.query;

    if (status === '') status = null;
    if (policyId === '') policyId = null;

    if (status === undefined) status = 'pending';

    const result = await db.query(
      `
          SELECT
              pts.*,
              lp.name as policy_name,
              l.name as library_name,
              (SELECT COUNT(*) FROM unnest(pts.supporting_feedback_ids) as fid) as evidence_count
          FROM policy_tuning_suggestions pts
          JOIN library_policies lp ON pts.policy_id = lp.id
          JOIN libraries l ON lp.library_id = l.id
          WHERE ($1::text IS NULL OR pts.status = $1)
            AND ($2::int IS NULL OR pts.policy_id = $2)
          ORDER BY pts.confidence DESC, pts.created_at DESC
        `,
      [status, policyId],
    );

    return sendData(res, result.rows);
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const suggestion = await db.query(
      `
          SELECT pts.*, lp.name as policy_name, l.name as library_name
          FROM policy_tuning_suggestions pts
          JOIN library_policies lp ON pts.policy_id = lp.id
          JOIN libraries l ON lp.library_id = l.id
          WHERE pts.id = $1
        `,
      [id],
    );

    if (suggestion.rows.length === 0) {
      throw new NotFoundError('Suggestion not found');
    }

    const feedbackIds = suggestion.rows[0].supporting_feedback_ids || [];
    let feedback = { rows: [] };

    if (feedbackIds.length > 0) {
      feedback = await db.query(
        `
            SELECT
                pfl.*,
                l.name as original_library,
                l2.name as selected_library
            FROM policy_feedback_log pfl
            LEFT JOIN libraries l ON pfl.top_suggestion_library_id = l.id
            LEFT JOIN libraries l2 ON pfl.selected_library_id = l2.id
            WHERE pfl.id = ANY($1)
            ORDER BY pfl.prompted_at DESC
          `,
        [feedbackIds],
      );
    }

    return sendData(res, {
      ...suggestion.rows[0],
      supporting_feedback: feedback.rows,
    });
  }));

  router.post('/:id/apply', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id || 1;

    const result = await feedbackAnalysis.applySuggestion(id, userId);

    return sendSuccess(res, { result });
  }));

  router.post('/:id/reject', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || 1;

    const result = await feedbackAnalysis.rejectSuggestion(id, userId, reason);
    return sendSuccess(res, { result });
  }));

  router.get('/:id/impact', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const suggestion = await db.query(
      `
          SELECT
              pts.*,
              pls.accuracy_rate as current_accuracy,
              pls.auto_accuracy_rate as current_auto_accuracy
          FROM policy_tuning_suggestions pts
          LEFT JOIN policy_learning_stats pls ON pts.policy_id = pls.policy_id
          WHERE pts.id = $1
        `,
      [id],
    );

    if (suggestion.rows.length === 0) {
      throw new NotFoundError('Suggestion not found');
    }

    const currentSuggestion = suggestion.rows[0];

    return sendData(res, {
      before_accuracy: currentSuggestion.before_accuracy,
      after_accuracy: currentSuggestion.current_accuracy,
      improvement: currentSuggestion.current_accuracy - (currentSuggestion.before_accuracy || 0),
      applied_at: currentSuggestion.applied_at,
    });
  }));

  router.get('/policy/:policyId/summary', asyncHandler(async (req, res) => {
    const { policyId } = req.params;

    const result = await db.query(
      `
          SELECT
              COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
              COUNT(*) FILTER (WHERE status = 'applied') as applied_count,
              COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
              AVG(confidence) FILTER (WHERE status = 'pending') as avg_pending_confidence
          FROM policy_tuning_suggestions
          WHERE policy_id = $1
        `,
      [policyId],
    );

    return sendData(res, result.rows[0]);
  }));

  return router;
}
