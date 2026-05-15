import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  testImageEmbeddingConnection,
  getImageModelMetadata,
  getRagGraphFillRate,
  reembedImages,
} from '../../api/ragImageEmbeddingApi'

describe('ragImageEmbeddingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('testImageEmbeddingConnection calls POST with data', async () => {
    const data = { url: 'http://embed:8000', apiKey: 'key' }
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    const result = await testImageEmbeddingConnection(data)
    expect(mockPost).toHaveBeenCalledWith('/rag/image-test-connection', data)
    expect(result).toEqual({ data: { success: true } })
  })

  it('getImageModelMetadata calls POST with empty default', async () => {
    mockPost.mockResolvedValueOnce({ data: { models: ['clip'] } })
    const result = await getImageModelMetadata()
    expect(mockPost).toHaveBeenCalledWith('/rag/image-models-metadata', {})
    expect(result).toEqual({ data: { models: ['clip'] } })
  })

  it('getImageModelMetadata passes provided data', async () => {
    const data = { provider: 'openai' }
    mockPost.mockResolvedValueOnce({ data: { models: ['dino'] } })
    await getImageModelMetadata(data)
    expect(mockPost).toHaveBeenCalledWith('/rag/image-models-metadata', data)
  })

  it('getRagGraphFillRate calls getDataRequest with /rag/graph/fill-rate', async () => {
    const fillRate = { total: 100, pct_collection: 80 }
    mockGetDataRequest.mockResolvedValueOnce(fillRate)
    const result = await getRagGraphFillRate()
    expect(mockGetDataRequest).toHaveBeenCalledWith('/rag/graph/fill-rate')
    expect(result).toEqual(fillRate)
  })

  it('reembedImages calls POST /rag/reembed-images', async () => {
    mockPost.mockResolvedValueOnce({ data: { started: true } })
    const result = await reembedImages()
    expect(mockPost).toHaveBeenCalledWith('/rag/reembed-images')
    expect(result).toEqual({ data: { started: true } })
  })
})
