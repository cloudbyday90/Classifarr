/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api/core', () => ({ getDataRequest: mocks.get, apiClient: { post: mocks.post } }))
import { previewLibraryArchive, confirmLibraryArchive, getLibraryArchiveReceipt } from '@/api/libraryArchiveApi'

it('uses named GET helpers, encoded path segments and a strong write precondition', async () => {
  mocks.get.mockResolvedValue({ reason: 'confirmation_required' })
  expect(await previewLibraryArchive('1/2')).toEqual({ reason: 'confirmation_required' })
  expect(mocks.get).toHaveBeenLastCalledWith('/media-server/libraries/1%2F2/archive')
  await getLibraryArchiveReceipt(1, 'a/b')
  expect(mocks.get).toHaveBeenLastCalledWith('/media-server/libraries/1/archive/receipts/a%2Fb')
  const response = { data: { receipt: { auditId: 1 } } }, body = { requestId: 'synthetic', workersStopped: true }
  mocks.post.mockResolvedValue(response)
  expect(await confirmLibraryArchive(1, body, '"revision"')).toBe(response)
  expect(mocks.post).toHaveBeenCalledWith('/media-server/libraries/1/archive', body, { headers: { 'If-Match': '"revision"' }, skipAutomaticRetry: true })
})
