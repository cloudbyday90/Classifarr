/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test, vi } from 'vitest'
const { post } = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../../api/core', () => ({ apiClient: { post } }))
import { submitClassificationFeedback } from '../../api/feedbackApi'
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

test.each([400, 409, 500])('propagates %s without automatic retries', async status => {
  const error = { response: { status, data: { code: 'FEEDBACK_SOURCE_CONFLICT' } } }
  post.mockRejectedValue(error)
  await expect(submitClassificationFeedback({})).rejects.toBe(error)
  expect(post).toHaveBeenCalledTimes(1)
})
