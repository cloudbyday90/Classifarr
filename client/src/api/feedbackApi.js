/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { apiClient, getDataRequest } from './core'

/**
 * Records one feedback observation for a completed source classification.
 * Supply classification_id, selected_library_id, selected_policy_id and optional
 * user_reason/user_reason_text. Candidate evidence comes from stored history.
 * Returns raw Axios response: data.feedbackId and data.replayed (201 new, 200 replay).
 * Conflicting submissions return 409; no automatic transport retry is performed.
 */
export function submitClassificationFeedback(feedback) {
  return apiClient.post('/feedback', feedback)
}

export function prepareFeedbackReview(classificationId) {
  return apiClient.post(`/feedback/${encodeURIComponent(classificationId)}/review`, {}, { skipAutomaticRetry: true })
}
export function submitFeedbackReview(classificationId, command) {
  return apiClient.post(`/feedback/${encodeURIComponent(classificationId)}/review/submit`, command, { skipAutomaticRetry: true })
}
export function getFeedbackReviewReceipt(classificationId, reviewId) {
  return getDataRequest(`/feedback/${encodeURIComponent(classificationId)}/review/${encodeURIComponent(reviewId)}/receipt`, { skipAutomaticRetry: true })
}
export default { submitClassificationFeedback, prepareFeedbackReview, submitFeedbackReview, getFeedbackReviewReceipt }
