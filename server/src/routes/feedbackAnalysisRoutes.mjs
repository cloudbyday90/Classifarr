/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireAdmin } from '../middleware/auth.mjs';
import { parseCanonicalDatabaseInt32Id } from '../services/databaseIntegerValues.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { createLogger } from '../utils/logger.mjs';
import { requireSuggestionAdministratorId } from './suggestionReviewInput.mjs';

const logger = createLogger('FeedbackAnalysisRoutes');

export function registerFeedbackAnalysisRoutes(router, feedbackAnalysis) {
  router.post('/policies/:id/analyze', requireAdmin, asyncHandler(async (req, res) => {
    const actorId = requireSuggestionAdministratorId(req.user.id);
    const policyId = parseCanonicalDatabaseInt32Id(req.params.id);
    if (policyId === null) {
      throw new ValidationError('Invalid policy ID. Use a whole number from 1 to 2147483647 in decimal form.');
    }

    const days = Number.parseInt(req.body.days, 10);
    const minFeedback = Number.parseInt(req.body.minFeedback, 10);
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

    logger.info('Manual suggestion analysis requested', { actorId, scope: 'policy', policyId });
    const analysis = await feedbackAnalysis.analyzePolicy(policyId, options);
    return res.json({ success: true, ...analysis });
  }));

  router.post('/analyze-all', requireAdmin, asyncHandler(async (req, res) => {
    const actorId = requireSuggestionAdministratorId(req.user.id);
    logger.info('Manual suggestion analysis requested', { actorId, scope: 'enabled_policies' });
    const results = await feedbackAnalysis.runFullAnalysis();
    return res.json({ success: true, ...results });
  }));
}
