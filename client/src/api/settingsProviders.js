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

export function testOllama(host, port) {
  return apiClient.post('/settings/ollama/test', { host, port })
}

export function getOllamaModels(host, port) {
  return apiClient.get('/settings/ollama/models', { params: { host, port } })
}

export function getLastOllamaPreflight() {
  return apiClient.get('/settings/ollama/preflight/last')
}

export function getTavilyConfig() {
  return apiClient.get('/settings/tavily')
}

export function updateTavilyConfig(data) {
  return apiClient.put('/settings/tavily', data)
}

export function testTavily(data) {
  return apiClient.post('/settings/tavily/test', data)
}

export function getOMDbConfig() {
  return apiClient.get('/settings/omdb')
}

export function updateOMDbConfig(data) {
  return apiClient.put('/settings/omdb', data)
}

export function testOMDb(data) {
  return apiClient.post('/settings/omdb/test', data)
}

export function getAIConfig() {
  return apiClient.get('/settings/ai')
}

export function updateAIConfig(data) {
  return apiClient.put('/settings/ai', data)
}

export function testAIConnection(data) {
  return apiClient.post('/settings/ai/test', data)
}

export function getAIModels(data) {
  return apiClient.post('/settings/ai/models', data)
}

export function getAIUsage() {
  return getDataRequest('/settings/ai/usage')
}

const settingsProvidersApi = {
  testOllama,
  getOllamaModels,
  getLastOllamaPreflight,
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
}

export default settingsProvidersApi
