/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
const integer = value => Number.isInteger(value) && value > 0 && value <= 2147483647
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const label = value => typeof value === 'string' && value.length > 0 && value.length <= 255
export function feedbackReviewClassificationId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null
  if (!['number', 'string'].includes(typeof value)) return null
  const text = String(value)
  return /^[1-9][0-9]{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n ? text : null
}
export function normalizeFeedbackReview(value, classificationId) {
  if (!exact(value, ['version', 'reviewId', 'issuedAt', 'expiresAt', 'item', 'reference', 'choices']) ||
    value.version !== 'feedback.review.v1' || !uuid(value.reviewId) || !time(value.issuedAt) || !time(value.expiresAt) ||
    Date.parse(value.expiresAt) - Date.parse(value.issuedAt) !== 600000 ||
    !exact(value.item, ['classificationId', 'mediaType', 'tmdbId', 'title', 'currentOutcome']) ||
    value.item.classificationId !== classificationId || !['movie', 'tv'].includes(value.item.mediaType) || !integer(value.item.tmdbId) ||
    typeof value.item.title !== 'string' || value.item.title.length > 500 ||
    value.item.currentOutcome !== null && !label(value.item.currentOutcome) ||
    !exact(value.reference, ['kind', 'libraryId', 'libraryName']) || value.reference.kind !== 'original_automated_destination' ||
    !integer(value.reference.libraryId) || !label(value.reference.libraryName) || !Array.isArray(value.choices) ||
    value.choices.length < 1 || value.choices.length > 128 || !value.choices.every(choice => exact(choice,
      ['libraryId', 'libraryName', 'policyId', 'policyName']) && integer(choice.libraryId) && integer(choice.policyId) && label(choice.libraryName) && label(choice.policyName)) ||
    new Set(value.choices.map(choice => choice.policyId)).size !== value.choices.length ||
    !value.choices.some(choice => choice.libraryId === value.reference.libraryId && choice.libraryName === value.reference.libraryName)) return null
  return value
}
export function normalizeFeedbackReviewReceipt(value, classificationId, reviewId) {
  if (!exact(value, ['version', 'classificationId', 'reviewId', 'status', 'feedbackId', 'recordedAt']) ||
    value.version !== 'feedback.review_receipt.v1' || value.classificationId !== classificationId || value.reviewId !== reviewId ||
    !['recorded', 'unverified'].includes(value.status) || (value.status === 'recorded'
      ? !time(value.recordedAt) || value.feedbackId !== null && !integer(value.feedbackId)
      : value.feedbackId !== null || value.recordedAt !== null)) return null
  return value
}
const prefix = 'classifarr:v1:feedback-review:'
function validPending(value, id) {
  return exact(value, ['classificationId', 'command']) && value.classificationId === id &&
    exact(value.command, ['reviewId', 'action', 'selected_library_id', 'selected_policy_id']) && uuid(value.command.reviewId) &&
    ['confirmation', 'correction'].includes(value.command.action) && integer(value.command.selected_library_id) && integer(value.command.selected_policy_id)
}
export function readPendingFeedbackReview(id) {
  try { const value = JSON.parse(sessionStorage.getItem(prefix + id)); return validPending(value, id) ? value : null } catch { return null }
}
export function storePendingFeedbackReview(value) {
  try { sessionStorage.setItem(prefix + value.classificationId, JSON.stringify(value)); return true } catch { return false }
}
export function clearPendingFeedbackReview(id) {
  try { sessionStorage.removeItem(prefix + id) } catch { /* Recovery remains available in memory. */ }
}
