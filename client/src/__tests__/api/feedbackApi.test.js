/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test, vi } from 'vitest'
const { post, getDataRequest } = vi.hoisted(() => ({ post: vi.fn(), getDataRequest: vi.fn() }))
vi.mock('../../api/core', () => ({ apiClient: { post }, getDataRequest }))
import { submitClassificationFeedback, prepareFeedbackReview, submitFeedbackReview, getFeedbackReviewReceipt } from '../../api/feedbackApi'
import classificationApi from '../../api/classification'

beforeEach(() => vi.resetAllMocks())

test.each([false, true])('preserves the raw response and replay state %s', async replayed => {
  const body = { classification_id: '9223372036854775807', selected_library_id: 1, selected_policy_id: 2 }
  const response = { status: replayed ? 200 : 201, data: { success: true, feedbackId: 4, replayed } }
  post.mockResolvedValue(response)
  expect(await submitClassificationFeedback(body)).toBe(response)
  expect(post).toHaveBeenCalledWith('/feedback', body)
  expect(classificationApi.submitClassificationFeedback).toBe(submitClassificationFeedback)
})

test('review commands preserve raw responses and suppress automatic retries; receipt uses the GET helper', async () => {
  const response = { data: { reviewId: 'reference' }, status: 200 }
  post.mockResolvedValue(response)
  expect(await prepareFeedbackReview('9223372036854775807')).toBe(response)
  expect(post).toHaveBeenLastCalledWith('/feedback/9223372036854775807/review', {}, { skipAutomaticRetry: true })
  const command = { reviewId: 'reference', action: 'confirmation' }
  expect(await submitFeedbackReview('7', command)).toBe(response)
  expect(post).toHaveBeenLastCalledWith('/feedback/7/review/submit', command, { skipAutomaticRetry: true })
  getDataRequest.mockResolvedValue({ status: 'unverified' })
  expect(await getFeedbackReviewReceipt('7', 'a/b')).toEqual({ status: 'unverified' })
  expect(getDataRequest).toHaveBeenLastCalledWith('/feedback/7/review/a%2Fb/receipt', { skipAutomaticRetry: true })
  expect(classificationApi.prepareFeedbackReview).toBe(prepareFeedbackReview)
  expect(classificationApi.submitFeedbackReview).toBe(submitFeedbackReview)
  expect(classificationApi.getFeedbackReviewReceipt).toBe(getFeedbackReviewReceipt)
})

test.each([400, 409, 500])('propagates %s without automatic retries', async status => {
  const error = { response: { status, data: { code: 'FEEDBACK_SOURCE_CONFLICT' } } }
  post.mockRejectedValue(error)
  await expect(submitClassificationFeedback({})).rejects.toBe(error)
  expect(post).toHaveBeenCalledTimes(1)
})
