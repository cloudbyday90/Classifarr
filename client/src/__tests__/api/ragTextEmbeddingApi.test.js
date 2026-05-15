import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPost = vi.fn()

vi.mock('../../api/core', () => ({
  apiClient: {
    post: (...args) => mockPost(...args),
  },
}))

import {
  getRagTextModels,
  testRagConnection,
} from '../../api/ragTextEmbeddingApi'

describe('ragTextEmbeddingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getRagTextModels calls POST with default empty object', async () => {
    mockPost.mockResolvedValueOnce({ data: [] })
    await getRagTextModels()
    expect(mockPost).toHaveBeenCalledWith('/rag/text-models', {})
  })

  it('getRagTextModels passes data', async () => {
    mockPost.mockResolvedValueOnce({ data: [] })
    await getRagTextModels({ provider: 'ollama' })
    expect(mockPost).toHaveBeenCalledWith('/rag/text-models', { provider: 'ollama' })
  })

  it('testRagConnection calls POST with data', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } })
    await testRagConnection({ host: 'localhost', port: 11434 })
    expect(mockPost).toHaveBeenCalledWith('/rag/test-connection', { host: 'localhost', port: 11434 })
  })
})
