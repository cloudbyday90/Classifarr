/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const reviewId = '2e851bf4-9497-4b99-8b7c-e8117a05c762'
export const feedbackReviewFixture = () => ({ version: 'feedback.review.v1', reviewId,
  issuedAt: '2026-10-28T12:00:00.000Z', expiresAt: '2026-10-28T12:10:00.000Z',
  item: { classificationId: '7', mediaType: 'movie', tmdbId: 603, title: 'Synthetic review', currentOutcome: 'Current outcome' },
  reference: { kind: 'original_automated_destination', libraryId: 1, libraryName: 'Original destination' },
  choices: [{ libraryId: 1, libraryName: 'Original destination', policyId: 11, policyName: 'Original policy' },
    { libraryId: 2, libraryName: 'Other destination', policyId: 22, policyName: 'Other policy' }] })
export const feedbackCommandFixture = () => ({ reviewId, action: 'confirmation', selected_library_id: 1, selected_policy_id: 11 })
export const feedbackReceiptFixture = () => ({ version: 'feedback.review_receipt.v1', classificationId: '7', reviewId,
  status: 'recorded', feedbackId: 9, recordedAt: '2026-10-28T12:01:00.000Z' })
