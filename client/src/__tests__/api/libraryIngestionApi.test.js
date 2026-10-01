/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/core', () => ({ getDataRequest: mocks.get, apiClient: { post: mocks.post } }))
import { previewLibraryIngestion, reconcileLibraryIngestion, resumeLibraryIngestion, getLibraryIngestionReceipt, getLibraryIngestionHistory } from '@/api/libraryIngestionApi'

it('uses named GET helpers, encoded path segments and a strong write precondition', async () => {
  mocks.get.mockResolvedValue({ reason: 'confirmation_required' })
  expect(await previewLibraryIngestion('1/2')).toEqual({ reason: 'confirmation_required' })
  expect(mocks.get).toHaveBeenLastCalledWith('/libraries/1%2F2/ingestion-reconciliation')
  await getLibraryIngestionReceipt(1, 'a/b')
  expect(mocks.get).toHaveBeenLastCalledWith('/libraries/1/ingestion-reconciliation/receipts/a%2Fb')
  await getLibraryIngestionHistory('1/2')
  expect(mocks.get).toHaveBeenLastCalledWith('/libraries/1%2F2/ingestion-reconciliation/history')
  const response = { data: { receipt: { auditId: 1 } } }, body = { requestId: 'synthetic', workersStopped: true }
  mocks.post.mockResolvedValue(response)
  expect(await reconcileLibraryIngestion(1, body, '"revision"')).toBe(response)
  expect(mocks.post).toHaveBeenCalledWith('/libraries/1/ingestion-reconciliation', body, { headers: { 'If-Match': '"revision"' }, skipAutomaticRetry: true })
  expect(await resumeLibraryIngestion(1, body, '"revision"')).toBe(response)
  expect(mocks.post).toHaveBeenLastCalledWith('/libraries/1/ingestion-reconciliation', { ...body, resume: true }, { headers: { 'If-Match': '"revision"' }, skipAutomaticRetry: true })
  expect(body).not.toHaveProperty('resume')
})
