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
import { ValidationError } from '../utils/appError.mjs';
import { requireValidId } from './routeHelpers.mjs';
import { recordStandaloneFeedback } from '../services/standaloneFeedbackService.mjs';

function parseIdParam(value) {
  return Number.parseInt(value, 10);
}

export function createFeedbackRouter({ express, feedbackAnalysis, db }) {
  const router = express.Router();

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

  router.post('/policies/:id/analyze', asyncHandler(async (req, res) => {
    const policyId = requireValidId(req.params.id, 'policy ID');

    const days = parseIdParam(req.body.days);
    const minFeedback = parseIdParam(req.body.minFeedback);

    const options = {
      days: Number.isNaN(days) ? 30 : days,
      minFeedback: Number.isNaN(minFeedback) ? 5 : minFeedback,
    };

    if (!Number.isInteger(options.days) || options.days < 1 || options.days > 365) {
      throw new ValidationError('Invalid days parameter. Must be an integer between 1 and 365.');
    }

    if (!Number.isInteger(options.minFeedback) || options.minFeedback < 1 || options.minFeedback > 1000) {
      throw new ValidationError('Invalid minFeedback parameter. Must be an integer between 1 and 1000.');
    }

    const analysis = await feedbackAnalysis.analyzePolicy(policyId, options);

    return res.json({
      success: true,
      ...analysis,
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

  router.post('/suggestions/:id/apply', asyncHandler(async (req, res) => {
    const suggestionId = requireValidId(req.params.id, 'suggestion ID');
    const userId = req.user.id;

    const result = await feedbackAnalysis.applySuggestion(suggestionId, userId);

    return res.json({
      success: true,
      ...result,
      message: 'Suggestion applied successfully',
    });
  }));

  router.post('/suggestions/:id/reject', asyncHandler(async (req, res) => {
    const suggestionId = requireValidId(req.params.id, 'suggestion ID');
    const userId = req.user.id;
    const reason = req.body.reason || 'Not applicable';

    const result = await feedbackAnalysis.rejectSuggestion(suggestionId, userId, reason);

    return res.json({
      success: true,
      ...result,
      message: 'Suggestion rejected',
    });
  }));

  router.post('/analyze-all', asyncHandler(async (_req, res) => {
    const results = await feedbackAnalysis.runFullAnalysis();

    return res.json({
      success: true,
      ...results,
    });
  }));

  return router;
}
