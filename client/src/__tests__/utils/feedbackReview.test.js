/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, beforeEach } from 'vitest'
import { feedbackReviewClassificationId, normalizeFeedbackReview, normalizeFeedbackReviewReceipt,
  readPendingFeedbackReview, storePendingFeedbackReview, clearPendingFeedbackReview } from '@/utils/feedbackReview'
import { feedbackReviewFixture, feedbackCommandFixture, feedbackReceiptFixture } from '../fixtures/feedbackReviewFixture'
beforeEach(() => sessionStorage.clear())
test.each([null, true, '01', '-1', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1])('rejects unsafe classification identity %s', value => expect(feedbackReviewClassificationId(value)).toBeNull())
test('preserves exact int64 identities', () => expect(feedbackReviewClassificationId('9223372036854775807')).toBe('9223372036854775807'))
test.each([
  value => { value.reference.kind = 'server_shortlist_at_commit' },
  value => { value.expiresAt = value.issuedAt },
  value => { value.item.classificationId = '8' },
  value => { value.choices.push(value.choices[0]) },
  value => { value.choices = [] },
  value => { value.extra = true },
])('rejects malformed or misbound preparation', mutate => {
  const value = feedbackReviewFixture(); mutate(value); expect(normalizeFeedbackReview(value, '7')).toBeNull()
})
test('validates exact receipt identity and redacted uncertainty', () => {
  const receipt = feedbackReceiptFixture()
  expect(normalizeFeedbackReviewReceipt(receipt, '7', receipt.reviewId)).toEqual(receipt)
  expect(normalizeFeedbackReviewReceipt(receipt, '8', receipt.reviewId)).toBeNull()
  expect(normalizeFeedbackReviewReceipt({ ...receipt, status: 'unverified' }, '7', receipt.reviewId)).toBeNull()
})
test('stores only the exact recovery command and rejects malformed or foreign saved state', () => {
  const pending = { classificationId: '7', command: feedbackCommandFixture() }
  expect(storePendingFeedbackReview(pending)).toBe(true); expect(readPendingFeedbackReview('7')).toEqual(pending)
  sessionStorage.setItem('classifarr:v1:feedback-review:7', JSON.stringify({ ...pending, extra: 'not allowed' }))
  expect(readPendingFeedbackReview('7')).toBeNull(); clearPendingFeedbackReview('7'); expect(sessionStorage.length).toBe(0)
})
