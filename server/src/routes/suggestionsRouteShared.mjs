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
import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import { requireAdmin } from '../middleware/auth.mjs';
import { parseCanonicalDatabaseInt32Id } from '../services/databaseIntegerValues.mjs';
import { MAX_SUGGESTION_EVIDENCE_REFERENCES, readSavedSuggestionEvidencePage } from '../services/savedSuggestionEvidence.mjs';
import { readSavedSuggestionProposal } from '../services/savedSuggestionProposal.mjs';
import { readSuggestionId, readSuggestionReviewIds } from './suggestionReviewInput.mjs';

// The compatibility decision took effect on November 23, 2026 Eastern.
const LEGACY_DETAIL_DEPRECATED = `@${Date.UTC(2026, 10, 23, 5) / 1000}`;

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

  /**
   * @openapi
   * /api/suggestions/{id}:
   *   get:
   *     tags: [Suggestions]
   *     deprecated: true
   *     summary: Read legacy full suggestion detail
   *     description: >-
   *       Signed-in clients can migrate proposal and status fields to
   *       `/api/suggestions/{id}/proposal`. Administrators can read bounded,
   *       attributed feedback through `/api/suggestions/{id}/evidence`.
   *       The evidence pages omit raw metadata and free-text notes.
   *       The legacy response remains during migration with no scheduled removal date.
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       '200':
   *         description: Legacy full detail with a Deprecation header
   */
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

    res.set('Deprecation', LEGACY_DETAIL_DEPRECATED);
    res.append('Link', '</api/docs/>; rel="deprecation"');
    return sendData(res, {
      ...suggestion.rows[0],
      supporting_feedback: feedback.rows,
    });
  }));

  /**
   * @openapi
   * /api/suggestions/{id}/proposal:
   *   get:
   *     tags: [Suggestions]
   *     summary: Read a bounded saved suggestion proposal
   *     description: >-
   *       Signed-in members and administrators can read proposal and status fields.
   *       Unsupported configuration has proposal_status unavailable and a null suggestion_config.
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema: { type: integer, minimum: 1, maximum: 2147483647 }
   *     responses:
   *       '200': { description: Bounded proposal }
   *       '400': { description: Invalid suggestion ID }
   *       '401': { description: Authentication required }
   *       '404': { description: Suggestion not found }
   */
  router.get('/:id/proposal', asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const body = await readSavedSuggestionProposal(db, readSuggestionId(req.params.id));
    return res.type('json').send(body);
  }));

  router.get('/:id/evidence', requireAdmin, asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { suggestionId } = readSuggestionReviewIds(req.params.id, req.user.id);
    const query = req.query;
    if (Object.keys(query).some(key => key !== 'afterPosition')) {
      throw new ValidationError('Use only the optional afterPosition parameter.');
    }
    const afterPosition = Object.hasOwn(query, 'afterPosition')
      ? parseCanonicalDatabaseInt32Id(query.afterPosition) : 0;
    if (afterPosition === null || afterPosition > MAX_SUGGESTION_EVIDENCE_REFERENCES) {
      throw new ValidationError(`afterPosition must be a decimal position from 1 to ${MAX_SUGGESTION_EVIDENCE_REFERENCES}.`);
    }
    const body = await readSavedSuggestionEvidencePage(db, suggestionId, afterPosition);
    return res.type('json').send(body);
  }));

  // Evidence/lifecycle conflicts propagate as 409; review is never retried here.
  router.post('/:id/apply', requireAdmin, asyncHandler(async (req, res) => {
    const { suggestionId, userId } = readSuggestionReviewIds(req.params.id, req.user.id);
    // This route exposes the suggestion ID as a string in its nested result.
    const result = await feedbackAnalysis.applySuggestion(String(suggestionId), userId);

    return sendSuccess(res, { result });
  }));

  router.post('/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
    const { suggestionId, userId } = readSuggestionReviewIds(req.params.id, req.user.id);
    const { reason } = req.body;
    const result = await feedbackAnalysis.rejectSuggestion(String(suggestionId), userId, reason);
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
          LEFT JOIN policy_feedback_learning_stats pls ON pts.policy_id = pls.policy_id
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
