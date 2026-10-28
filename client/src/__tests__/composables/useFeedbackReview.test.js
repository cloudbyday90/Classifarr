/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useFeedbackReview } from '@/composables/useFeedbackReview'
import { feedbackReviewFixture, feedbackCommandFixture, feedbackReceiptFixture } from '../fixtures/feedbackReviewFixture'
const { api } = vi.hoisted(() => ({ api: { prepareFeedbackReview: vi.fn(), submitFeedbackReview: vi.fn(), getFeedbackReviewReceipt: vi.fn() } }))
vi.mock('@/api', () => ({ default: api }))
let scope, review, id, now
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); now = 0; id = ref('7'); scope = effectScope()
  review = scope.run(() => useFeedbackReview(id, { steadyNow: () => now }))
  api.prepareFeedbackReview.mockResolvedValue({ data: feedbackReviewFixture() })
  api.submitFeedbackReview.mockResolvedValue({ data: { feedbackId: 9, classificationId: '7', reviewId: feedbackCommandFixture().reviewId } })
})
afterEach(() => { scope.stop(); vi.restoreAllMocks() })
test('requires a prepared exact reference and explicit matching action; does not auto-submit or infer the original from current outcome', async () => {
  await review.submit('confirmation', 11); expect(api.submitFeedbackReview).not.toHaveBeenCalled()
  await review.open(); expect(review.preview.value.reference.libraryName).toBe('Original destination')
  await review.submit('confirmation', 22); expect(api.submitFeedbackReview).not.toHaveBeenCalled()
  await review.submit('correction', 22)
  expect(api.submitFeedbackReview).toHaveBeenCalledWith('7', { ...feedbackCommandFixture(), action: 'correction', selected_library_id: 2, selected_policy_id: 22 })
  expect(review.phase.value).toBe('recorded'); expect(sessionStorage.length).toBe(0)
})
test('lost response then unauthorized retry preserves the exact command until verified receipt recovery', async () => {
  api.submitFeedbackReview.mockRejectedValueOnce(new Error('lost response')).mockRejectedValueOnce({ response: { status: 403 } })
  await review.open(); await review.submit('confirmation', 11)
  const pending = JSON.parse(JSON.stringify(review.pending.value))
  await review.retry(); expect(review.pending.value).toEqual(pending); expect(review.message.value).toContain('Sign in')
  review.close(); api.getFeedbackReviewReceipt.mockResolvedValue(feedbackReceiptFixture()); await review.open()
  expect(review.phase.value).toBe('recorded'); expect(review.pending.value).toBeNull()
  expect(api.prepareFeedbackReview).toHaveBeenCalledTimes(1)
  expect(api.submitFeedbackReview.mock.calls.map(call => call[1])).toEqual([pending.command, pending.command])
})
test('unverified or unavailable receipts do not create another choice; reload restores the command only', async () => {
  api.submitFeedbackReview.mockRejectedValue(new Error('lost')); api.getFeedbackReviewReceipt.mockResolvedValue({ ...feedbackReceiptFixture(), status: 'unverified', feedbackId: null, recordedAt: null })
  await review.open(); await review.submit('confirmation', 11); scope.stop()
  scope = effectScope(); review = scope.run(() => useFeedbackReview(id)); await review.open()
  expect(review.phase.value).toBe('unknown'); await review.prepare(); expect(api.prepareFeedbackReview).toHaveBeenCalledTimes(1)
  api.getFeedbackReviewReceipt.mockRejectedValue(new Error('offline')); await review.check()
  expect(review.pending.value.command).toEqual(feedbackCommandFixture()); expect(review.message.value).toContain('unknown')
})
test('a conflict while recovering under another account cannot erase the original command', async () => {
  api.submitFeedbackReview.mockRejectedValueOnce(new Error('lost')).mockRejectedValueOnce({ response: { status: 409, data: { code: 'FEEDBACK_SOURCE_CONFLICT' } } })
  await review.open(); await review.submit('confirmation', 11); await review.retry()
  expect(review.phase.value).toBe('unknown'); expect(review.pending.value.command).toEqual(feedbackCommandFixture())
  api.getFeedbackReviewReceipt.mockResolvedValue(feedbackReceiptFixture()); await review.check()
  expect(review.phase.value).toBe('recorded')
})
test('stale rejection permits a fresh explicit review; malformed success remains uncertain', async () => {
  await review.open(); api.submitFeedbackReview.mockRejectedValueOnce({ response: { status: 409, data: { code: 'FEEDBACK_REVIEW_CHANGED' } } })
  await review.submit('confirmation', 11); expect(review.pending.value).toBeNull(); expect(review.phase.value).toBe('unavailable')
  await review.prepare(); api.submitFeedbackReview.mockResolvedValue({ data: { feedbackId: 9, classificationId: '8' } })
  await review.submit('confirmation', 11); expect(review.phase.value).toBe('unknown'); expect(review.pending.value).not.toBeNull()
})
test('late preparations cannot reopen a closed review; local monotonic expiry blocks submit', async () => {
  let complete
  api.prepareFeedbackReview.mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
  const opened = review.open(); review.close(); complete({ data: feedbackReviewFixture() }); await opened
  expect(review.preview.value).toBeNull()
  await review.open(); now = 600001; review.preview.value = { ...review.preview.value }
  expect(review.expired.value).toBe(true); await review.submit('confirmation', 11); expect(api.submitFeedbackReview).not.toHaveBeenCalled()
})
test('blocked storage retains in-memory recovery across closing; deleted feedback rows still count as recorded', async () => {
  vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  api.submitFeedbackReview.mockRejectedValue(new Error('lost'))
  await review.open(); await review.submit('confirmation', 11); expect(review.warning.value).toContain('reload')
  review.close(); api.getFeedbackReviewReceipt.mockResolvedValue({ ...feedbackReceiptFixture(), feedbackId: null }); await review.open()
  expect(review.phase.value).toBe('recorded'); expect(review.message.value).toContain('no longer available')
})
