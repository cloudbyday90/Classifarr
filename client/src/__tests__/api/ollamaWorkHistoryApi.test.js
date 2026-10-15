/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
import { getDataRequest } from '../../api/core'
import { getOllamaWorkHistory } from '../../api/ollamaWorkHistoryApi'
vi.mock('../../api/core', () => ({ getDataRequest: vi.fn() }))
it('uses the named GET endpoint with filters and cancellation', async () => {
  const signal = new AbortController().signal
  getDataRequest.mockResolvedValue({ state: 'not_configured' })
  expect(await getOllamaWorkHistory({ taskId: '42' }, signal)).toEqual({ state: 'not_configured' })
  expect(getDataRequest).toHaveBeenLastCalledWith('/settings/ollama/gateway-history', { params: { taskId: '42' }, signal })
  await getOllamaWorkHistory()
  expect(getDataRequest).toHaveBeenLastCalledWith('/settings/ollama/gateway-history', { params: {}, signal: undefined })
})
