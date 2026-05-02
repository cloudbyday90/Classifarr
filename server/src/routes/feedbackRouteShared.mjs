/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function parseIdParam(value) {
  return Number.parseInt(value, 10);
}

export function createFeedbackRouter({ express, feedbackAnalysis, db, logger }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    try {
      const feedbackData = { ...req.body, userId: req.user.id };

      if (!feedbackData.tmdb_id || !feedbackData.selected_library_id || !feedbackData.selected_policy_id) {
        return res.status(400).json({
          error: 'Missing required fields: tmdb_id, selected_library_id, and selected_policy_id are required',
        });
      }

      const feedbackId = await feedbackAnalysis.recordFeedback(feedbackData);

      return res.status(201).json({
        success: true,
        feedbackId,
        message: 'Feedback recorded successfully',
      });
    } catch (error) {
      logger.error('Error recording feedback', { error: error.message });
      return res.status(500).json({
        error: 'Failed to record feedback',
        details: error.message,
      });
    }
  });

  router.get('/policies/:id/suggestions', async (req, res) => {
    try {
      const policyId = parseIdParam(req.params.id);

      if (Number.isNaN(policyId)) {
        return res.status(400).json({ error: 'Invalid policy ID' });
      }

      const suggestions = await feedbackAnalysis.getPendingSuggestions(policyId);

      return res.json({
        policyId,
        count: suggestions.length,
        suggestions,
      });
    } catch (error) {
      logger.error('Error getting suggestions', { error: error.message });
      return res.status(500).json({
        error: 'Failed to get suggestions',
        details: error.message,
      });
    }
  });

  router.post('/policies/:id/analyze', async (req, res) => {
    try {
      const policyId = parseIdParam(req.params.id);

      if (Number.isNaN(policyId)) {
        return res.status(400).json({ error: 'Invalid policy ID' });
      }

      const days = parseIdParam(req.body.days);
      const minFeedback = parseIdParam(req.body.minFeedback);

      const options = {
        days: Number.isNaN(days) ? 30 : days,
        minFeedback: Number.isNaN(minFeedback) ? 5 : minFeedback,
      };

      if (!Number.isInteger(options.days) || options.days < 1 || options.days > 365) {
        return res.status(400).json({
          error: 'Invalid days parameter. Must be an integer between 1 and 365.',
        });
      }

      if (!Number.isInteger(options.minFeedback) || options.minFeedback < 1 || options.minFeedback > 1000) {
        return res.status(400).json({
          error: 'Invalid minFeedback parameter. Must be an integer between 1 and 1000.',
        });
      }

      const analysis = await feedbackAnalysis.analyzePolicy(policyId, options);

      return res.json({
        success: true,
        ...analysis,
      });
    } catch (error) {
      logger.error('Error analyzing policy', { error: error.message });
      return res.status(500).json({
        error: 'Failed to analyze policy',
        details: error.message,
      });
    }
  });

  router.get('/policies/:id/stats', async (req, res) => {
    try {
      const policyId = parseIdParam(req.params.id);

      if (Number.isNaN(policyId)) {
        return res.status(400).json({ error: 'Invalid policy ID' });
      }

      const result = await db.query(
        `
          SELECT
              pls.*,
              lp.name as policy_name,
              lp.library_id,
              l.name as library_name
          FROM policy_learning_stats pls
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
    } catch (error) {
      logger.error('Error getting learning stats', { error: error.message });
      return res.status(500).json({
        error: 'Failed to get learning stats',
        details: error.message,
      });
    }
  });

  router.post('/suggestions/:id/apply', async (req, res) => {
    try {
      const suggestionId = parseIdParam(req.params.id);
      const userId = req.user.id;

      if (Number.isNaN(suggestionId)) {
        return res.status(400).json({ error: 'Invalid suggestion ID' });
      }

      const result = await feedbackAnalysis.applySuggestion(suggestionId, userId);

      return res.json({
        success: true,
        ...result,
        message: 'Suggestion applied successfully',
      });
    } catch (error) {
      logger.error('Error applying suggestion', { error: error.message });
      return res.status(500).json({
        error: 'Failed to apply suggestion',
        details: error.message,
      });
    }
  });

  router.post('/suggestions/:id/reject', async (req, res) => {
    try {
      const suggestionId = parseIdParam(req.params.id);
      const userId = req.user.id;
      const reason = req.body.reason || 'Not applicable';

      if (Number.isNaN(suggestionId)) {
        return res.status(400).json({ error: 'Invalid suggestion ID' });
      }

      const result = await feedbackAnalysis.rejectSuggestion(suggestionId, userId, reason);

      return res.json({
        success: true,
        ...result,
        message: 'Suggestion rejected',
      });
    } catch (error) {
      logger.error('Error rejecting suggestion', { error: error.message });
      return res.status(500).json({
        error: 'Failed to reject suggestion',
        details: error.message,
      });
    }
  });

  router.post('/analyze-all', async (_req, res) => {
    try {
      const results = await feedbackAnalysis.runFullAnalysis();

      return res.json({
        success: true,
        ...results,
      });
    } catch (error) {
      logger.error('Error running full analysis', { error: error.message });
      return res.status(500).json({
        error: 'Failed to run full analysis',
        details: error.message,
      });
    }
  });

  return router;
}
