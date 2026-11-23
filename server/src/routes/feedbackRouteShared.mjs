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
import { requireValidId } from './routeHelpers.mjs';
import { recordStandaloneFeedback } from '../services/standaloneFeedbackService.mjs';
import { registerFeedbackReviewRoutes } from './feedbackReviewRoutes.mjs';
import { registerFeedbackAnalysisRoutes } from './feedbackAnalysisRoutes.mjs';
import { requireAdmin } from '../middleware/auth.mjs';
import { readSuggestionReviewIds } from './suggestionReviewInput.mjs';

export function createFeedbackRouter({ express, feedbackAnalysis, db }) {
  const router = express.Router();
  registerFeedbackReviewRoutes(router, { db, feedbackAnalysis });
  registerFeedbackAnalysisRoutes(router, feedbackAnalysis);

  router.post('/', asyncHandler(async (req, res) => {
    const result = await recordStandaloneFeedback({ db, feedbackAnalysis, body: req.body });
    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      ...result,
      message: 'Feedback recorded successfully',
    });
  }));

  router.get('/policies/:id/suggestions', asyncHandler(async (req, res) => {
    const policyId = requireValidId(req.params.id, 'policy ID');

    const suggestions = await feedbackAnalysis.getPendingSuggestions(policyId);

    return res.json({
      policyId,
      count: suggestions.length,
      suggestions,
    });
  }));

  router.get('/policies/:id/stats', asyncHandler(async (req, res) => {
    const policyId = requireValidId(req.params.id, 'policy ID');

    const result = await db.query(
      `
          SELECT
              pls.*,
              lp.name as policy_name,
              lp.library_id,
              l.name as library_name
          FROM policy_feedback_learning_stats pls
          JOIN library_policies lp ON pls.policy_id = lp.id
          JOIN libraries l ON lp.library_id = l.id
          WHERE pls.policy_id = $1
        `,
      [policyId]
    );

    if (result.rows.length === 0) {
      return res.json({
        policyId,
        message: 'No learning statistics available yet',
        stats: null,
      });
    }

    return res.json({
      policyId,
      stats: result.rows[0],
    });
  }));

  router.post('/suggestions/:id/apply', requireAdmin, asyncHandler(async (req, res) => {
    const { suggestionId, userId } = readSuggestionReviewIds(req.params.id, req.user.id);
    const result = await feedbackAnalysis.applySuggestion(suggestionId, userId);

    return res.json({
      success: true,
      ...result,
      message: 'Suggestion applied successfully',
    });
  }));

  router.post('/suggestions/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
    const { suggestionId, userId } = readSuggestionReviewIds(req.params.id, req.user.id);
    const reason = req.body.reason || 'Not applicable';

    const result = await feedbackAnalysis.rejectSuggestion(suggestionId, userId, reason);

    return res.json({
      success: true,
      ...result,
      message: 'Suggestion rejected',
    });
  }));

  return router;
}
