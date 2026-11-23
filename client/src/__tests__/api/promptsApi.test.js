/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, test, vi } from 'vitest'
const { getDataRequest, post } = vi.hoisted(() => ({ getDataRequest: vi.fn(), post: vi.fn() }))
vi.mock('../../api/core', () => ({ getDataRequest, apiClient: { post } }))
import promptsApi from '../../api/promptsApi'
import adminApi from '../../api/admin'

beforeEach(() => vi.resetAllMocks())

test.each([
  ['getPendingPrompts', { limit: 8 }, '/prompts/pending', { params: { limit: 8 } }],
  ['getPromptBatch', { limit: 5 }, '/prompts/batch', { params: { limit: 5 } }],
  ['getPrompt', 42, '/prompts/42', undefined],
])('%s unwraps GET data through the transport helper', async (method, arg, url, options) => {
  getDataRequest.mockResolvedValue({ items: [] })
  expect(await promptsApi[method](arg)).toEqual({ items: [] })
  expect(getDataRequest.mock.calls[0]).toEqual(options ? [url, options] : [url])
  expect(adminApi[method]).toBe(promptsApi[method])
})

test.each(['getPendingPrompts', 'getPromptBatch'])('%s defaults to empty params', async method => {
  await promptsApi[method]()
  expect(getDataRequest.mock.calls[0][1]).toEqual({ params: {} })
})

test('response preserves the committed server count and raw Axios envelope', async () => {
  const payload = { selectedLibraryId: 1, patternActions: [{ type: 'studio', value: 'Fixture' }] }
  const response = { data: { success: true, data: { patternsCreated: 1, feedbackId: 4 } } }
  post.mockResolvedValue(response)
  expect(await adminApi.respondToPrompt(42, payload)).toBe(response)
  expect(post).toHaveBeenCalledWith('/prompts/42/respond', payload)
})

test('uses exact decimal text for large prompt detail and response URLs', async () => {
  const id = '9223372036854775807'
  const body = { selectedLibraryId: 1 }
  await promptsApi.getPrompt(id)
  await promptsApi.respondToPrompt(id, body)
  expect(getDataRequest).toHaveBeenCalledWith(`/prompts/${id}`)
  expect(post).toHaveBeenCalledWith(`/prompts/${id}/respond`, body)
})

test.each(['42x', '042', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid prompt ID %s before transport', async id => {
    await expect(promptsApi.getPrompt(id)).rejects.toThrow('Invalid prompt ID')
    await expect(promptsApi.respondToPrompt(id, { selectedLibraryId: 1 })).rejects.toThrow('Invalid prompt ID')
    expect(getDataRequest).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  },
)

test.each([400, 403, 409, 500])('propagates %s without manufacturing success or retrying', async status => {
  const error = { response: { status, data: { code: 'PROMPT_NOT_PENDING' } } }
  post.mockRejectedValue(error)
  await expect(promptsApi.respondToPrompt(42, { selectedLibraryId: 1 })).rejects.toBe(error)
  expect(post).toHaveBeenCalledTimes(1)
})
