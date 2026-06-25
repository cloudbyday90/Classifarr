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

import { apiClient, getDataRequest } from './core'

function createProviderApi(path) {
  const base = `/settings/${path}`
  return {
    getConfig: () => getDataRequest(base),
    updateConfig: (data) => apiClient.put(base, data),
    test: (data) => apiClient.post(`${base}/test`, data),
  }
}

const ollama = createProviderApi('ollama')
const tmdb = createProviderApi('tmdb')
const ssl = createProviderApi('ssl')
const tavily = createProviderApi('tavily')
const omdb = createProviderApi('omdb')
const ai = createProviderApi('ai')

export const getOllamaConfig = ollama.getConfig
export const updateOllamaConfig = ollama.updateConfig
export const testOllama = ollama.test

export function getOllamaModels(host, port) {
  return getDataRequest('/settings/ollama/models', { params: { host, port } })
}

export function getLastOllamaPreflight() {
  return getDataRequest('/settings/ollama/preflight/last')
}

export const getTMDBConfig = tmdb.getConfig
export const updateTMDBConfig = tmdb.updateConfig
export const testTMDB = tmdb.test

export const getSSLConfig = ssl.getConfig
export const updateSSLConfig = ssl.updateConfig
export const testSSL = ssl.test

export const getTavilyConfig = tavily.getConfig
export const updateTavilyConfig = tavily.updateConfig
export const testTavily = tavily.test

export function getWebSearchProviderConfigs() {
  return getDataRequest('/settings/web-search/providers')
}

export function getWebSearchProviderRouteDiagnostics() {
  return getDataRequest('/settings/web-search/providers/route-diagnostics')
}

export function getWebSearchProviderCalibrationPolicies() {
  return getDataRequest('/settings/web-search/provider-calibration-policies')
}

export function getWebSearchProviderCalibrationCoverage() {
  return getDataRequest('/settings/web-search/provider-calibration-policies/coverage')
}

export function getWebSearchProviderGuardrailThresholds() {
  return getDataRequest('/settings/web-search/provider-guardrail-thresholds')
}

export function updateWebSearchProviderGuardrailThresholds(data) {
  return apiClient.put('/settings/web-search/provider-guardrail-thresholds', data)
}

export function previewWebSearchProviderCalibrationPolicy(purpose, data) {
  return apiClient.post(`/settings/web-search/provider-calibration-policies/${purpose}/preview`, data)
}

export function updateWebSearchProviderCalibrationPolicy(purpose, data) {
  return apiClient.put(`/settings/web-search/provider-calibration-policies/${purpose}`, data)
}

export function updateWebSearchProviderConfig(providerKey, data) {
  return apiClient.put(`/settings/web-search/providers/${providerKey}`, data)
}

export function testWebSearchProvider(providerKey, data) {
  return apiClient.post(`/settings/web-search/providers/${providerKey}/test`, data)
}

export const getOMDbConfig = omdb.getConfig
export const updateOMDbConfig = omdb.updateConfig
export const testOMDb = omdb.test

export const getAIConfig = ai.getConfig
export const updateAIConfig = ai.updateConfig
export const testAIConnection = ai.test

export function getAIModels(data) {
  return apiClient.post('/settings/ai/models', data)
}

export function getAIUsage() {
  return getDataRequest('/settings/ai/usage')
}

const settingsProvidersApi = {
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
  getAIModels,
  getAIUsage,
}

export default settingsProvidersApi
