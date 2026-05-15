import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetDataRequest = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()

vi.mock('../../api/core', () => ({
  getDataRequest: (...args) => mockGetDataRequest(...args),
  apiClient: {
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
}))

import {
  getOllamaConfig,
  updateOllamaConfig,
  testOllama,
  getOllamaModels,
  getLastOllamaPreflight,
  getTMDBConfig,
  updateTMDBConfig,
  testTMDB,
  getSSLConfig,
  updateSSLConfig,
  testSSL,
  getTavilyConfig,
  updateTavilyConfig,
  testTavily,
  getOMDbConfig,
  updateOMDbConfig,
  testOMDb,
  getAIConfig,
  updateAIConfig,
  testAIConnection,
  getAIModels,
  getAIUsage,
} from '../../api/settingsProviders'

describe('settingsProvidersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Ollama', () => {
    it('getOllamaConfig calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({ host: 'localhost' })
      await getOllamaConfig()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/ollama')
    })

    it('updateOllamaConfig calls PUT', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateOllamaConfig({ host: 'newhost' })
      expect(mockPut).toHaveBeenCalledWith('/settings/ollama', { host: 'newhost' })
    })

    it('testOllama calls POST', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await testOllama({ host: 'localhost', port: 11434 })
      expect(mockPost).toHaveBeenCalledWith('/settings/ollama/test', { host: 'localhost', port: 11434 })
    })

    it('getOllamaModels passes host and port as params', async () => {
      mockGetDataRequest.mockResolvedValueOnce([])
      await getOllamaModels('host', 11434)
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/ollama/models', { params: { host: 'host', port: 11434 } })
    })

    it('getLastOllamaPreflight calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({})
      await getLastOllamaPreflight()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/ollama/preflight/last')
    })
  })

  describe('TMDB', () => {
    it('getTMDBConfig calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({})
      await getTMDBConfig()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/tmdb')
    })

    it('updateTMDBConfig calls PUT', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateTMDBConfig({ api_key: 'key' })
      expect(mockPut).toHaveBeenCalledWith('/settings/tmdb', { api_key: 'key' })
    })

    it('testTMDB calls POST', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await testTMDB({ api_key: 'key' })
      expect(mockPost).toHaveBeenCalledWith('/settings/tmdb/test', { api_key: 'key' })
    })
  })

  describe('SSL', () => {
    it('getSSLConfig calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({})
      await getSSLConfig()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/ssl')
    })

    it('updateSSLConfig calls PUT', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateSSLConfig({ cert_path: '/certs/cert.pem' })
      expect(mockPut).toHaveBeenCalledWith('/settings/ssl', { cert_path: '/certs/cert.pem' })
    })

    it('testSSL calls POST', async () => {
      mockPost.mockResolvedValueOnce({ data: { valid: true } })
      await testSSL({ cert_path: '/c' })
      expect(mockPost).toHaveBeenCalledWith('/settings/ssl/test', { cert_path: '/c' })
    })
  })

  describe('Tavily', () => {
    it('getTavilyConfig calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({})
      await getTavilyConfig()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/tavily')
    })

    it('updateTavilyConfig calls PUT', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateTavilyConfig({ apiKey: 'k' })
      expect(mockPut).toHaveBeenCalledWith('/settings/tavily', { apiKey: 'k' })
    })

    it('testTavily calls POST', async () => {
      mockPost.mockResolvedValueOnce({ data: {} })
      await testTavily({ apiKey: 'k' })
      expect(mockPost).toHaveBeenCalledWith('/settings/tavily/test', { apiKey: 'k' })
    })
  })

  describe('OMDb', () => {
    it('getOMDbConfig calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({})
      await getOMDbConfig()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/omdb')
    })

    it('updateOMDbConfig calls PUT', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateOMDbConfig({ api_key: 'k' })
      expect(mockPut).toHaveBeenCalledWith('/settings/omdb', { api_key: 'k' })
    })

    it('testOMDb calls POST', async () => {
      mockPost.mockResolvedValueOnce({ data: {} })
      await testOMDb({ api_key: 'k' })
      expect(mockPost).toHaveBeenCalledWith('/settings/omdb/test', { api_key: 'k' })
    })
  })

  describe('AI', () => {
    it('getAIConfig calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({})
      await getAIConfig()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/ai')
    })

    it('updateAIConfig calls PUT', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateAIConfig({ provider: 'ollama' })
      expect(mockPut).toHaveBeenCalledWith('/settings/ai', { provider: 'ollama' })
    })

    it('testAIConnection calls POST', async () => {
      mockPost.mockResolvedValueOnce({ data: {} })
      await testAIConnection({ provider: 'ollama' })
      expect(mockPost).toHaveBeenCalledWith('/settings/ai/test', { provider: 'ollama' })
    })

    it('getAIModels calls POST', async () => {
      mockPost.mockResolvedValueOnce({ data: [] })
      await getAIModels({ provider: 'ollama' })
      expect(mockPost).toHaveBeenCalledWith('/settings/ai/models', { provider: 'ollama' })
    })

    it('getAIUsage calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce({})
      await getAIUsage()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/ai/usage')
    })
  })
})
