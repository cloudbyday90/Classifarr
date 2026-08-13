/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
  getWebSearchProviderConfigs,
  getWebSearchProviderRouteDiagnostics,
  getWebSearchProviderCalibrationPolicies,
  getWebSearchProviderCalibrationCoverage,
  getWebSearchProviderGuardrailThresholds,
  getWebSearchProviderGuardrailAnalytics,
  getWebSearchProviderGuardrailDigest,
  updateWebSearchProviderGuardrailThresholds,
  previewWebSearchProviderCalibrationPolicy,
  updateWebSearchProviderCalibrationPolicy,
  updateWebSearchProviderConfig,
  testWebSearchProvider,
  getOMDbConfig,
  updateOMDbConfig,
  testOMDb,
  getAIConfig,
  updateAIConfig,
  testAIConnection,
  preflightAIVerificationConfig,
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

  describe('Web Search Providers', () => {
    it('getWebSearchProviderConfigs calls getDataRequest', async () => {
      mockGetDataRequest.mockResolvedValueOnce([])
      await getWebSearchProviderConfigs()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/web-search/providers')
    })

    it('getWebSearchProviderRouteDiagnostics calls the diagnostics endpoint', async () => {
      mockGetDataRequest.mockResolvedValueOnce({ candidates: [] })
      await getWebSearchProviderRouteDiagnostics()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/web-search/providers/route-diagnostics')
    })

    it('getWebSearchProviderCalibrationPolicies calls the calibration policy endpoint', async () => {
      mockGetDataRequest.mockResolvedValueOnce([])
      await getWebSearchProviderCalibrationPolicies()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/web-search/provider-calibration-policies')
    })

    it('getWebSearchProviderCalibrationCoverage calls the coverage endpoint', async () => {
      mockGetDataRequest.mockResolvedValueOnce({ purposes: [] })
      await getWebSearchProviderCalibrationCoverage()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/web-search/provider-calibration-policies/coverage')
    })

    it('getWebSearchProviderGuardrailThresholds calls the threshold endpoint', async () => {
      mockGetDataRequest.mockResolvedValueOnce({ enabled: true })
      await getWebSearchProviderGuardrailThresholds()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/web-search/provider-guardrail-thresholds')
    })

    it('getWebSearchProviderGuardrailAnalytics calls the analytics endpoint', async () => {
      mockGetDataRequest.mockResolvedValueOnce({ totalCount: 0 })
      await getWebSearchProviderGuardrailAnalytics()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/web-search/provider-guardrail-analytics')
    })

    it('getWebSearchProviderGuardrailDigest calls the digest endpoint', async () => {
      mockGetDataRequest.mockResolvedValueOnce({ level: 'clear' })
      await getWebSearchProviderGuardrailDigest()
      expect(mockGetDataRequest).toHaveBeenCalledWith('/settings/web-search/provider-guardrail-digest')
    })

    it('updateWebSearchProviderGuardrailThresholds calls PUT for threshold controls', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateWebSearchProviderGuardrailThresholds({ lowSampleMultiplier: 2 })
      expect(mockPut).toHaveBeenCalledWith(
        '/settings/web-search/provider-guardrail-thresholds',
        { lowSampleMultiplier: 2 }
      )
    })

    it('updateWebSearchProviderCalibrationPolicy calls PUT for the selected purpose', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateWebSearchProviderCalibrationPolicy('classification', { minimumSamples: 5 })
      expect(mockPut).toHaveBeenCalledWith(
        '/settings/web-search/provider-calibration-policies/classification',
        { minimumSamples: 5 }
      )
    })

    it('previewWebSearchProviderCalibrationPolicy calls POST for the selected purpose', async () => {
      mockPost.mockResolvedValueOnce({ data: {} })
      await previewWebSearchProviderCalibrationPolicy('classification', { minimumSamples: 5 })
      expect(mockPost).toHaveBeenCalledWith(
        '/settings/web-search/provider-calibration-policies/classification/preview',
        { minimumSamples: 5 }
      )
    })

    it('updateWebSearchProviderConfig calls PUT for the selected provider', async () => {
      mockPut.mockResolvedValueOnce({ data: {} })
      await updateWebSearchProviderConfig('tavily', { isEnabled: true })
      expect(mockPut).toHaveBeenCalledWith('/settings/web-search/providers/tavily', { isEnabled: true })
    })

    it('testWebSearchProvider calls POST for the selected provider', async () => {
      mockPost.mockResolvedValueOnce({ data: { success: true } })
      await testWebSearchProvider('tavily', { apiKey: 'k' })
      expect(mockPost).toHaveBeenCalledWith('/settings/web-search/providers/tavily/test', { apiKey: 'k' })
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

    it('preflightAIVerificationConfig posts only the supplied capability payload', async () => {
      mockPost.mockResolvedValueOnce({ data: {} })
      const payload = {
        primary_provider: 'gemini',
        model: 'gemini-3-pro-preview',
        ollama_fallback_enabled: false,
        ollama_for_budget_exhausted: true,
        ollama_model: 'llama3.2'
      }

      await preflightAIVerificationConfig(payload)

      expect(mockPost).toHaveBeenCalledWith('/settings/ai/verification-preflight', payload)
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
