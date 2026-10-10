/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mockGet = vi.fn()
const mockPost = vi.fn()
vi.mock('../../api/core', () => ({ getDataRequest: (...args) => mockGet(...args), apiClient: { post: (...args) => mockPost(...args) } }))
import { confirmMediaIdentity, getMediaIdentityReviewItems, previewMediaIdentity, getMediaIdentityReceipt, reviewSourceScope, inspectSourceScope,
  approveSourceScope, getSourceMappings, revokeSourceMapping } from '../../api/mediaIdentityReviewApi'
import mediaServerApi from '../../api/mediaServer'

beforeEach(() => vi.clearAllMocks())
describe('media identity API leaf', () => {
  it('unwraps reads through the shared GET helper and passes filters', async () => {
    mockGet.mockResolvedValue({ items: [] })
    expect(await getMediaIdentityReviewItems({ mediaType: 'tv', afterId: 4 })).toEqual({ items: [] })
    expect(mockGet).toHaveBeenCalledWith('/media-identity-review', { params: { mediaType: 'tv', afterId: 4 } })
    await getMediaIdentityReviewItems()
    expect(mockGet).toHaveBeenLastCalledWith('/media-identity-review', { params: {} })
  })
  it('preserves mutation responses and sends exact preview and confirmation bodies', async () => {
    const response = { data: { previewId: 'preview' } }
    mockPost.mockResolvedValue(response)
    const body = { tmdbId: 12, sourceVersion: 'source' }
    expect(await previewMediaIdentity(7, body)).toBe(response)
    expect(mockPost).toHaveBeenLastCalledWith('/media-identity-review/7/preview', body)
    const confirmation = { previewId: 'preview', confirmed: true }
    expect(await confirmMediaIdentity(7, confirmation)).toBe(response)
    expect(mockPost).toHaveBeenLastCalledWith('/media-identity-review/7/confirm', confirmation, { skipAutomaticRetry: true })
  })
  it('reads receipts through the GET helper with encoded path segments', async () => {
    mockGet.mockResolvedValue({ status: 'not_observed', receipt: null })
    expect(await getMediaIdentityReceipt('7/8', 'preview?x')).toEqual({ status: 'not_observed', receipt: null })
    expect(mockGet).toHaveBeenCalledWith('/media-identity-review/7%2F8/receipts/preview%3Fx', { skipAutomaticRetry: true })
    expect(mockPost).not.toHaveBeenCalled()
  })
  it('wires all named functions through the domain aggregator', () => {
    expect(mediaServerApi).toMatchObject({ getMediaIdentityReviewItems, previewMediaIdentity, confirmMediaIdentity, getMediaIdentityReceipt,
      reviewSourceScope, inspectSourceScope, approveSourceScope, getSourceMappings, revokeSourceMapping })
  })
  it('checks scope drafts without automatic replay and preserves the raw response', async () => {
    const response = { data: { canApply: false } }, body = { scope: {} }
    mockPost.mockResolvedValue(response)
    expect(await reviewSourceScope('key/next', body)).toBe(response)
    expect(mockPost).toHaveBeenCalledWith('/media-identity-review/source-scopes/key%2Fnext/review', body, { skipAutomaticRetry: true })
  })
  it('checks fresh evidence with cancellation, bounded timeout and no automatic replay', async () => {
    const signal = new AbortController().signal, body = { scope: {} }, response = { data: {} }
    mockPost.mockResolvedValue(response)
    expect(await inspectSourceScope('key/next', body, signal)).toBe(response)
    expect(mockPost).toHaveBeenCalledWith('/media-identity-review/source-scopes/key%2Fnext/evidence', body,
      { skipAutomaticRetry: true, timeout: 105000, signal })
  })
  it('uses named mapping endpoints without automatic mutation retries', async () => {
    const signal = new AbortController().signal, body = { confirmed: true }, response = { data: {} }
    mockPost.mockResolvedValue(response)
    expect(await approveSourceScope('key/next', body, signal)).toBe(response)
    expect(mockPost).toHaveBeenLastCalledWith('/media-identity-review/source-scopes/key%2Fnext/approve', body,
      { skipAutomaticRetry: true, timeout: 105000, signal })
    expect(await revokeSourceMapping('id/next')).toBe(response)
    expect(mockPost).toHaveBeenLastCalledWith('/media-identity-review/source-scopes/mappings/id%2Fnext/revoke', body, { skipAutomaticRetry: true })
    await getSourceMappings()
    expect(mockGet).toHaveBeenLastCalledWith('/media-identity-review/source-scopes/mappings', { params: {}, skipAutomaticRetry: true })
    await getSourceMappings({ offset: 50 })
    expect(mockGet).toHaveBeenLastCalledWith('/media-identity-review/source-scopes/mappings', { params: { offset: 50 }, skipAutomaticRetry: true })
  })
})
