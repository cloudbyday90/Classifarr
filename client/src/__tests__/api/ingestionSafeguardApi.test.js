/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/core', () => ({ getDataRequest: mocks.get, apiClient: { post: mocks.post } }))
import { previewIngestionSafeguardRepair, repairIngestionSafeguards } from '@/api/ingestionSafeguardApi'
it('uses named requests and never automatically retries a maintenance mutation', async () => {
  mocks.get.mockResolvedValue({ reason: 'not_needed' })
  expect(await previewIngestionSafeguardRepair()).toEqual({ reason: 'not_needed' })
  expect(mocks.get).toHaveBeenCalledWith('/libraries/ingestion-safeguards')
  const response = { data: { status: 'repaired' } }
  mocks.post.mockResolvedValue(response)
  expect(await repairIngestionSafeguards('review-token')).toBe(response)
  expect(mocks.post).toHaveBeenCalledWith('/libraries/ingestion-safeguards', { token: 'review-token', confirm: true },
    { timeout: 150000, skipAutomaticRetry: true })
})
