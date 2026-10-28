/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { canonicalDatabaseBigintId } from './databaseIntegerValues.mjs';
import { normalizeStandaloneFeedback } from './standaloneFeedbackInput.mjs';
import { ValidationError, ConflictError } from '../utils/appError.mjs';

export const FEEDBACK_REVIEW_TTL_MS = 600000;
export const feedbackReviewExact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const feedbackReviewUuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
export const feedbackReviewTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const feedbackReviewHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const feedbackReviewActorBinding = (actorKey, classificationId, reviewId) =>
  feedbackReviewHash(['feedback.review.actor.v1', actorKey, classificationId, reviewId]);
export function feedbackReviewId(value) {
  const id = canonicalDatabaseBigintId(value);
  if (!id) throw new ValidationError('Invalid classification ID');
  return id;
}
export function feedbackReviewBody(body) {
  if (!feedbackReviewExact(body, [])) throw new ValidationError('Review preparation does not accept fields');
}
export function normalizeFeedbackReviewCommand(classificationId, body) {
  if (!feedbackReviewExact(body, ['reviewId', 'action', 'selected_library_id', 'selected_policy_id']) ||
      !feedbackReviewUuid(body.reviewId) || !['confirmation', 'correction'].includes(body.action)) {
    throw new ValidationError('An explicit action and valid review reference are required');
  }
  return { reviewId: body.reviewId, action: body.action, input: normalizeStandaloneFeedback({
    classification_id: feedbackReviewId(classificationId), selected_library_id: body.selected_library_id,
    selected_policy_id: body.selected_policy_id }) };
}
export function feedbackReviewChanged() {
  return new ConflictError('The review is unavailable, expired or changed. Review the item again.', { code: 'FEEDBACK_REVIEW_CHANGED' });
}
