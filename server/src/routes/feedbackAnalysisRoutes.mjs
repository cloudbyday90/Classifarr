/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { requireAdmin } from '../middleware/auth.mjs';
import { parseCanonicalDatabaseInt32Id } from '../services/databaseIntegerValues.mjs';
import { tryRunManualSuggestionAnalysis } from '../services/manualSuggestionAnalysisAdmission.mjs';
import { serializeSuggestionAnalysisSummary, SUGGESTION_ANALYSIS_SUMMARY_FORMAT }
  from '../services/manualSuggestionAnalysisSummary.mjs';
import { ValidationError } from '../utils/appError.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { createLogger } from '../utils/logger.mjs';
import { requireSuggestionAdministratorId } from './suggestionReviewInput.mjs';

const logger = createLogger('FeedbackAnalysisRoutes');

async function respondToManualAnalysis(res, context, analyze, summary = false) {
  const admitted = await tryRunManualSuggestionAnalysis(async () => {
    logger.info('Manual suggestion analysis requested', context);
    const result = await analyze();
    if (summary) {
      res.set('Cache-Control', 'no-store').type('json').send(serializeSuggestionAnalysisSummary(result));
    } else {
      res.json({ success: true, ...result });
    }
  });

  if (!admitted) {
    return res.status(503).set('Cache-Control', 'no-store').json({
      code: 'SUGGESTION_ANALYSIS_BUSY',
      error: 'Manual analysis is already running. Try again after it finishes.',
    });
  }
}

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

    return respondToManualAnalysis(res, { actorId, scope: 'policy', policyId },
      () => feedbackAnalysis.analyzePolicy(policyId, options));
  }));

  router.post('/analyze-all', requireAdmin, asyncHandler(async (req, res) => {
    const actorId = requireSuggestionAdministratorId(req.user.id);
    const context = { actorId, scope: 'enabled_policies' };
    if (!Object.hasOwn(req.query, 'format')) {
      return respondToManualAnalysis(res, context, () => feedbackAnalysis.runFullAnalysis());
    }
    if (req.query.format !== SUGGESTION_ANALYSIS_SUMMARY_FORMAT ||
        Object.keys(req.query).some(key => key !== 'format' && key !== 'afterPolicyId')) {
      throw new ValidationError('Use format=summary-v1 and an optional afterPolicyId.');
    }
    const afterPolicyId = Object.hasOwn(req.query, 'afterPolicyId')
      ? parseCanonicalDatabaseInt32Id(req.query.afterPolicyId) : 0;
    if (afterPolicyId === null) throw new ValidationError('afterPolicyId must be a canonical positive INTEGER policy ID.');
    return respondToManualAnalysis(res, context, () => feedbackAnalysis.runSummaryAnalysis(afterPolicyId), true);
  }));
}
