/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export default {
  // Media Server
  getMediaServerConfig() {
    return apiClient.get('/media-server')
  },
  updateMediaServerConfig(config) {
    return apiClient.post('/media-server', config)
  },
  testMediaServerConnection(config) {
    return apiClient.post('/media-server/test', config)
  },
  syncMediaServer() {
    return apiClient.post('/media-server/sync')
  },

  // Plex OAuth
  createPlexPin() {
    return apiClient.post('/plex/pin')
  },
  checkPlexPin(pinId) {
    return apiClient.get(`/plex/pin/${pinId}`)
  },
  getPlexServers(authToken) {
    return apiClient.post('/plex/servers', { authToken })
  },
  getPlexUser(authToken) {
    return apiClient.post('/plex/user', { authToken })
  },
  testPlexConnection(url, token) {
    return apiClient.post('/plex/test-connection', { url, token })
  },
  findPlexConnection(server) {
    return apiClient.post('/plex/find-connection', { server })
  },
  savePlexServer(name, url, token) {
    return apiClient.post('/plex/save-server', { name, url, token })
  },

  // Libraries
  getLibraries() {
    return apiClient.get('/libraries')
  },
  getLibrary(id) {
    return apiClient.get(`/libraries/${id}`)
  },
  updateLibrary(id, data) {
    return apiClient.put(`/libraries/${id}`, data)
  },
  getLibraryLabels(id) {
    return apiClient.get(`/libraries/${id}/labels`)
  },
  addLibraryLabel(id, data) {
    return apiClient.post(`/libraries/${id}/labels`, data)
  },
  removeLibraryLabel(id, labelId) {
    return apiClient.delete(`/libraries/${id}/labels/${labelId}`)
  },
  getLibraryRules(id) {
    return apiClient.get(`/libraries/${id}/rules`)
  },
  addLibraryRule(id, data) {
    return apiClient.post(`/libraries/${id}/rules`, data)
  },
  updateLibraryRule(id, ruleId, data) {
    return apiClient.put(`/libraries/${id}/rules/${ruleId}`, data)
  },
  deleteLibraryRule(id, ruleId) {
    return apiClient.delete(`/libraries/${id}/rules/${ruleId}`)
  },
  getLabelPresets() {
    return apiClient.get('/libraries/label-presets/all')
  },
  getLibraryArrOptions(id) {
    return apiClient.get(`/libraries/${id}/arr-options`)
  },
  updateLibraryArrSettings(id, settings) {
    return apiClient.put(`/libraries/${id}/arr-settings`, { settings })
  },
  syncArrProfiles() {
    return apiClient.post('/libraries/sync-arr-profiles')
  },

  // Classification
  classify(data) {
    return apiClient.post('/classification/classify', data)
  },
  getHistory(params) {
    return apiClient.get('/classification/history', { params })
  },
  getClassification(id) {
    return apiClient.get(`/classification/history/${id}`)
  },
  submitCorrection(data) {
    return apiClient.post('/classification/corrections', data)
  },
  getStats() {
    return apiClient.get('/classification/stats')
  },

  // Rule Builder
  startRuleBuilder(data) {
    return apiClient.post('/rule-builder/start', data)
  },
  sendRuleBuilderMessage(data) {
    return apiClient.post('/rule-builder/message', data)
  },
  generateRule(data) {
    return apiClient.post('/rule-builder/generate', data)
  },
  testRule(data) {
    return apiClient.post('/rule-builder/test', data)
  },

  // Settings
  getSettings() {
    return apiClient.get('/settings')
  },
  updateSettings(data) {
    return apiClient.put('/settings', data)
  },

  // Radarr
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
  getRadarrRootFolders(id) {
    return apiClient.get(`/settings/radarr/${id}/root-folders`)
  },
  getRadarrQualityProfiles(id) {
    return apiClient.get(`/settings/radarr/${id}/quality-profiles`)
  },

  // Sonarr
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
  getSonarrRootFolders(id) {
    return apiClient.get(`/settings/sonarr/${id}/root-folders`)
  },
  getSonarrQualityProfiles(id) {
    return apiClient.get(`/settings/sonarr/${id}/quality-profiles`)
  },

  // Ollama
  getOllamaConfig() {
    return apiClient.get('/settings/ollama')
  },
  updateOllamaConfig(data) {
    return apiClient.put('/settings/ollama', data)
  },
  testOllama() {
    return apiClient.post('/settings/ollama/test')
  },
  getOllamaModels() {
    return apiClient.get('/settings/ollama/models')
  },

  // TMDB
  getTMDBConfig() {
    return apiClient.get('/settings/tmdb')
  },
  updateTMDBConfig(data) {
    return apiClient.put('/settings/tmdb', data)
  },

  // Notifications
  getNotificationConfig() {
    return apiClient.get('/settings/notifications')
  },
  updateNotificationConfig(data) {
    return apiClient.put('/settings/notifications', data)
  },

  // Tavily
  getTavilyConfig() {
    return apiClient.get('/settings/tavily')
  },
  updateTavilyConfig(data) {
    return apiClient.put('/settings/tavily', data)
  },
  testTavily(data) {
    return apiClient.post('/settings/tavily/test', data)
  },
  testTavilySearch(data) {
    return apiClient.post('/settings/tavily/search', data)
  },

  // Webhook
  getWebhookConfig() {
    return apiClient.get('/settings/webhook')
  },
  updateWebhookConfig(config) {
    return apiClient.put('/settings/webhook', config)
  },
  generateWebhookKey() {
    return apiClient.post('/settings/webhook/generate-key')
  },
  getWebhookUrl() {
    return apiClient.get('/settings/webhook/url')
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
}
