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

// Add request interceptor to attach auth token
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

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

  // Jellyfin Auth
  testJellyfinConnection(serverUrl) {
    return apiClient.post('/jellyfin/test', { serverUrl })
  },
  isJellyfinQuickConnectEnabled(serverUrl) {
    return apiClient.post('/jellyfin/quick-connect/enabled', { serverUrl })
  },
  initiateJellyfinQuickConnect(serverUrl) {
    return apiClient.post('/jellyfin/quick-connect/initiate', { serverUrl })
  },
  checkJellyfinQuickConnect(serverUrl, secret) {
    return apiClient.post('/jellyfin/quick-connect/check', { serverUrl, secret })
  },
  authenticateJellyfinQuickConnect(serverUrl, secret) {
    return apiClient.post('/jellyfin/quick-connect/authenticate', { serverUrl, secret })
  },
  authenticateJellyfin(serverUrl, username, password) {
    return apiClient.post('/jellyfin/authenticate', { serverUrl, username, password })
  },
  saveJellyfinServer(serverUrl, token, serverName) {
    return apiClient.post('/jellyfin/save', { serverUrl, token, serverName })
  },

  // Emby Auth
  testEmbyConnection(serverUrl) {
    return apiClient.post('/emby/test', { serverUrl })
  },
  authenticateEmby(serverUrl, username, password) {
    return apiClient.post('/emby/authenticate', { serverUrl, username, password })
  },
  verifyEmbyToken(serverUrl, token) {
    return apiClient.post('/emby/verify', { serverUrl, token })
  },
  saveEmbyServer(serverUrl, token, serverName) {
    return apiClient.post('/emby/save', { serverUrl, token, serverName })
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
  syncLibrary(id, options = {}) {
    return apiClient.post(`/libraries/${id}/sync`, options)
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
  getLibraryRule(libraryId, ruleId) {
    return apiClient.get(`/libraries/${libraryId}/rules/${ruleId}`)
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
  getRuleSuggestions(id) {
    return apiClient.get(`/libraries/${id}/rules/suggest`)
  },
  getSmartSuggestions(id) {
    return apiClient.get(`/libraries/${id}/rules/smart-suggest`)
  },
  getPatternSuggestions(libraryId, contentType) {
    return apiClient.get(`/libraries/${libraryId}/rule-suggestions/${contentType}`)
  },
  getAvailablePatterns(libraryId) {
    return apiClient.get(`/libraries/${libraryId}/available-patterns`)
  },
  getPendingSuggestions() {
    return apiClient.get('/libraries/pending-suggestions')
  },
  dismissSuggestions(libraryId) {
    return apiClient.post(`/libraries/${libraryId}/dismiss-suggestions`)
  },
  refreshPatterns(libraryId) {
    return apiClient.post(`/libraries/${libraryId}/refresh-patterns`)
  },
  autoGenerateRules(id) {
    return apiClient.post(`/libraries/${id}/rules/auto-generate`)
  },
  autoGenerateAllRules() {
    return apiClient.post('/libraries/auto-generate-all')
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
  previewRule(data) {
    return apiClient.post('/rule-builder/preview', data)
  },

  getRuleStats(libraryId) {
    return apiClient.get(`/rule-builder/stats/${libraryId}`)
  },
  analyzeLibrary(libraryId) {
    return apiClient.post(`/rule-builder/analyze/${libraryId}`)
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

  // OMDb
  getOMDbConfig() {
    return apiClient.get('/settings/omdb')
  },
  updateOMDbConfig(data) {
    return apiClient.put('/settings/omdb', data)
  },
  testOMDb(data) {
    return apiClient.post('/settings/omdb/test', data)
  },
  testOMDbSearch(data) {
    return apiClient.post('/settings/omdb/search', data)
  },

  // AI Providers
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
    return apiClient.get('/settings/ai/usage')
  },
  getAIStatus() {
    return apiClient.get('/settings/ai/status')
  },
  resetAIUsage() {
    return apiClient.post('/settings/ai/reset-usage')
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

  // Queue
  getQueueStats() {
    return apiClient.get('/queue/stats')
  },
  getPendingTasks(limit = 20) {
    return apiClient.get('/queue/pending', { params: { limit } })
  },
  retryTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/retry`)
  },
  cancelTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/cancel`)
  },

  // Multi-Request Manager
  getWebhookConfigs() {
    return apiClient.get('/settings/webhook/configs')
  },
  getWebhookConfigById(id) {
    return apiClient.get(`/settings/webhook/configs/${id}`)
  },
  createWebhookConfig(config) {
    return apiClient.post('/settings/webhook/configs', config)
  },
  updateWebhookConfig(id, config) {
    return apiClient.put(`/settings/webhook/configs/${id}`, config)
  },
  deleteWebhookConfig(id) {
    return apiClient.delete(`/settings/webhook/configs/${id}`)
  },
  setPrimaryWebhookConfig(id) {
    return apiClient.post(`/settings/webhook/configs/${id}/primary`)
  },

  // Manual Requests
  searchTMDB(query, type = 'multi') {
    return apiClient.get('/requests/search', { params: { q: query, type } })
  },
  submitManualRequest(data) {
    return apiClient.post('/requests/submit', data)
  },
  getRecentManualRequests(limit = 10) {
    return apiClient.get('/requests/recent', { params: { limit } })
  },

  // System
  getSystemHealth() {
    return apiClient.get('/system/health')
  },
  getSystemStatus() {
    return apiClient.get('/system/status')
  },

  // Statistics
  getDetailedStats() {
    return apiClient.get('/stats/detailed')
  },
  getDailyStats(days = 30) {
    return apiClient.get('/stats/daily', { params: { days } })
  },

  // Scheduler
  getScheduledTasks() {
    return apiClient.get('/scheduler')
  },
  createScheduledTask(data) {
    return apiClient.post('/scheduler', data)
  },
  updateScheduledTask(id, data) {
    return apiClient.put(`/scheduler/${id}`, data)
  },
  deleteScheduledTask(id) {
    return apiClient.delete(`/scheduler/${id}`)
  },
  runScheduledTask(id) {
    return apiClient.post(`/scheduler/${id}/run`)
  },

  // Backup
  exportBackup() {
    return apiClient.get('/backup/export')
  },
  importBackup(data, options = {}) {
    return apiClient.post('/backup/import', { data, options })
  },
  previewBackup(data) {
    return apiClient.post('/backup/preview', { data })
  },

  // Queue Management
  getQueueStats() {
    return apiClient.get('/queue/stats').then(r => r.data)
  },
  getQueuePending(limit = 20) {
    return apiClient.get(`/queue/pending?limit=${limit}`).then(r => r.data)
  },
  getQueueFailed(limit = 20) {
    return apiClient.get(`/queue/failed?limit=${limit}`).then(r => r.data)
  },
  retryQueueTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/retry`)
  },
  cancelQueueTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/cancel`)
  },
  clearCompletedTasks() {
    return apiClient.post('/queue/clear-completed')
  },
  clearFailedTasks() {
    return apiClient.post('/queue/clear-failed')
  },
  retryAllFailedTasks() {
    return apiClient.post('/queue/retry-all-failed')
  },
  cancelAllPendingTasks() {
    return apiClient.post('/queue/cancel-all-pending')
  },
  reprocessCompleted() {
    return apiClient.post('/queue/reprocess-completed')
  },
  clearAndResync() {
    return apiClient.post('/queue/clear-and-resync')
  },

  // Live Dashboard
  getLiveStats() {
    return apiClient.get('/queue/live-stats')
  },
  getLiveFeed(limit = 50) {
    return apiClient.get(`/classification/live-feed?limit=${limit}`)
  },
  getPendingTasks(limit = 5) {
    return apiClient.get(`/queue/pending?limit=${limit}`)
  },
  getOllamaStatus() {
    return apiClient.get('/queue/ollama-status')
  },
}
