/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/core', () => ({ getDataRequest: mocks.get, apiClient: { post: mocks.post } }))
import { previewLegacyEnrichmentRetries, recoverLegacyEnrichmentRetries, getLegacyEnrichmentRetryReceipt } from '@/api/legacyEnrichmentRetryApi'
it('encodes paths, uses named GETs and sends a strong write precondition with raw mutation response', async () => {
  mocks.get.mockResolvedValue({ items: [] })
  expect(await previewLegacyEnrichmentRetries('1/2')).toEqual({ items: [] })
  expect(mocks.get).toHaveBeenLastCalledWith('/libraries/1%2F2/legacy-enrichment-retries')
  await getLegacyEnrichmentRetryReceipt(1, 'a/b')
  expect(mocks.get).toHaveBeenLastCalledWith('/libraries/1/legacy-enrichment-retries/receipts/a%2Fb')
  const response = { data: { receipt: { auditId: 1 } } }, body = { requestId: 'synthetic', workersStopped: true }
  mocks.post.mockResolvedValue(response)
  expect(await recoverLegacyEnrichmentRetries(1, body, '"revision"')).toBe(response)
  expect(mocks.post).toHaveBeenCalledWith('/libraries/1/legacy-enrichment-retries', body, { headers: { 'If-Match': '"revision"' } })
})
