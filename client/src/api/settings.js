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

export default {
  getConfidenceSettings() {
    return apiClient.get('/settings/confidence')
  },

  updateConfidenceSettings(data) {
    return apiClient.put('/settings/confidence', data)
  },

  getConfidenceHistory(params) {
    return apiClient.get('/settings/confidence/history', { params })
  },

  revertConfidenceSetting(auditId) {
    return apiClient.post(`/settings/confidence/revert/${auditId}`)
  },

  exportConfidenceSettings() {
    return apiClient.post('/settings/confidence/export')
  },

  getRadarrConfig() {
    return apiClient.get('/settings/radarr')
  },

  addRadarrConfig(data) {
    return apiClient.post('/settings/radarr', data)
  },

  updateRadarrConfig(id, data) {
    return apiClient.put(`/settings/radarr/${id}`, data)
  },

  deleteRadarrConfig(id) {
    return apiClient.delete(`/settings/radarr/${id}`)
  },

  testRadarrConnection(config) {
    return apiClient.post('/settings/radarr/test', config)
  },

  getRadarrQualityProfiles(id) {
    return apiClient.get(`/settings/radarr/${id}/quality-profiles`)
  },

  getSonarrConfig() {
    return apiClient.get('/settings/sonarr')
  },

  addSonarrConfig(data) {
    return apiClient.post('/settings/sonarr', data)
  },

  updateSonarrConfig(id, data) {
    return apiClient.put(`/settings/sonarr/${id}`, data)
  },

  deleteSonarrConfig(id) {
    return apiClient.delete(`/settings/sonarr/${id}`)
  },

  testSonarrConnection(config) {
    return apiClient.post('/settings/sonarr/test', config)
  },

  getSonarrQualityProfiles(id) {
    return apiClient.get(`/settings/sonarr/${id}/quality-profiles`)
  },

  testOllama(host, port) {
    return apiClient.post('/settings/ollama/test', { host, port })
  },

  getOllamaModels(host, port) {
    return apiClient.get('/settings/ollama/models', { params: { host, port } })
  },

  getLastOllamaPreflight() {
    return apiClient.get('/settings/ollama/preflight/last')
  },

  getTavilyConfig() {
    return apiClient.get('/settings/tavily')
  },

  updateTavilyConfig(data) {
    return apiClient.put('/settings/tavily', data)
  },

  testTavily(data) {
    return apiClient.post('/settings/tavily/test', data)
  },

  getOMDbConfig() {
    return apiClient.get('/settings/omdb')
  },

  updateOMDbConfig(data) {
    return apiClient.put('/settings/omdb', data)
  },

  testOMDb(data) {
    return apiClient.post('/settings/omdb/test', data)
  },

  getAIConfig() {
    return apiClient.get('/settings/ai')
  },

  updateAIConfig(data) {
    return apiClient.put('/settings/ai', data)
  },

  testAIConnection(data) {
    return apiClient.post('/settings/ai/test', data)
  },

  getAIModels(data) {
    return apiClient.post('/settings/ai/models', data)
  },

  getAIUsage() {
    return getDataRequest('/settings/ai/usage')
  },

  getWebhookConfig() {
    return apiClient.get('/settings/webhook')
  },

  updateWebhookConfig(config) {
    return apiClient.put('/settings/webhook', config)
  },

  generateWebhookKey() {
    return apiClient.post('/settings/webhook/generate-key')
  },

  getWebhookSecret() {
    return apiClient.get('/settings/webhook/secret')
  },

  getWebhookLogs(params) {
    return apiClient.get('/settings/webhook/logs', { params })
  },

  getWebhookStats() {
    return apiClient.get('/settings/webhook/stats')
  },

  testWebhook() {
    return apiClient.post('/settings/webhook/test')
  },

  getWebhookConfigs() {
    return apiClient.get('/settings/webhook/configs')
  },

  createWebhookConfig(config) {
    return apiClient.post('/settings/webhook/configs', config)
  },

  deleteWebhookConfig(id) {
    return apiClient.delete(`/settings/webhook/configs/${id}`)
  },

  setPrimaryWebhookConfig(id) {
    return apiClient.post(`/settings/webhook/configs/${id}/primary`)
  },
}
