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

import axios from 'axios'

const CSRF_COOKIE_NAME = 'classifarr_csrf_token'

let refreshInProgress = null

function getCookieValue(name) {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const cookies = document.cookie.split(';')

  for (const rawCookie of cookies) {
    const cookie = rawCookie.trim()
    if (cookie.startsWith(encodedName)) {
      return decodeURIComponent(cookie.substring(encodedName.length))
    }
  }

  return null
}

function getCsrfToken() {
  return getCookieValue(CSRF_COOKIE_NAME)
}

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

function getSettingsRequest(category = null) {
  if (category) {
    return apiClient.get(`/settings/category/${category}`)
  }
  return apiClient.get('/settings')
}

function updateSettingsRequest(categoryOrSettings, settings = null) {
  if (settings !== null && typeof categoryOrSettings === 'string') {
    return apiClient.put(`/settings/category/${categoryOrSettings}`, settings)
  }
  return apiClient.put('/settings', categoryOrSettings)
}

function getPendingQueueRequest(limit = 20) {
  return apiClient.get('/queue/pending', { params: { limit } })
}

function retryQueueTaskRequest(taskId) {
  return apiClient.post(`/queue/task/${taskId}/retry`)
}

function cancelQueueTaskRequest(taskId) {
  return apiClient.post(`/queue/task/${taskId}/cancel`)
}

async function refreshAccessToken() {
  if (refreshInProgress) {
    return refreshInProgress
  }

  refreshInProgress = (async () => {
    try {
      const csrfToken = getCsrfToken()
      // Refresh token is sent automatically as an httpOnly cookie
      const response = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
      })
      return response
    } catch (error) {
      throw error
    } finally {
      refreshInProgress = null
    }
  })()

  return refreshInProgress
}

apiClient.interceptors.request.use(
  config => {
    const method = (config.method || 'get').toUpperCase()
    const needsCsrfHeader = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

    if (needsCsrfHeader) {
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        config.headers = {
          ...(config.headers || {}),
          'X-CSRF-Token': csrfToken
        }
      }
    }

    return config
  },
  error => Promise.reject(error)
)

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true

    try {
      await refreshAccessToken()
      return apiClient(originalRequest)
    } catch (refreshError) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true'
      }
      
      return Promise.reject(error)
    }
  }

  if (error.response?.status === 401) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?expired=true'
    }
  }

  return Promise.reject(error)
  }
)

export default {
  login(identifier, password, rememberMe = false) {
    return apiClient.post('/auth/login', { identifier, password, rememberMe })
  },

  logout() {
    // Refresh token is cleared server-side; cookie cleared via Set-Cookie response header
    return apiClient.post('/auth/logout', {})
  },

  logoutAll() {
    return apiClient.post('/auth/logout-all')
  },

  getMe() {
    return apiClient.get('/auth/me')
  },

  clearAuth() {
    // Session state is managed server-side via httpOnly cookies — no client-side cleanup needed
  },

  get(url, config) {
    return apiClient.get(url, config)
  },
  post(url, data, config) {
    return apiClient.post(url, data, config)
  },
  put(url, data, config) {
    return apiClient.put(url, data, config)
  },
  patch(url, data, config) {
    return apiClient.patch(url, data, config)
  },
  delete(url, config) {
    return apiClient.delete(url, config)
  },

  getSettings(category = null) {
    return getSettingsRequest(category)
  },
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
  updateSettings(categoryOrSettings, settings = null) {
    return updateSettingsRequest(categoryOrSettings, settings)
  },

  getMediaServerConfig() {
    return apiClient.get('/media-server')
  },
  getArrConfigStatus() {
    return apiClient.get('/settings/arr-config-status')
  },
  getSetupStatus() {
    return apiClient.get('/setup/status')
  },
  getSetupWizardStatus() {
    return apiClient.get('/settings/setup-status')
  },
  getHeartbeatSettings() {
    return apiClient.get('/settings/heartbeat')
  },
  updateHeartbeatSettings(data) {
    return apiClient.put('/settings/heartbeat', data)
  },
  getSystemHeartbeat() {
    return apiClient.get('/system/heartbeat')
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
  triggerIngestion() {
    return apiClient.post('/media-server/ingest')
  },
  async getMediaServers() {
    const response = await apiClient.get('/media-server')
    return { data: response.data ? [response.data] : [] }
  },

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
  savePlexServer(name, url, token, clientIdentifier) {
    return apiClient.post('/plex/save-server', { name, url, token, clientIdentifier })
  },

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

  testEmbyConnection(serverUrl) {
    return apiClient.post('/emby/test', { serverUrl })
  },
  authenticateEmby(serverUrl, username, password) {
    return apiClient.post('/emby/authenticate', { serverUrl, username, password })
  },
  saveEmbyServer(serverUrl, token, serverName) {
    return apiClient.post('/emby/save', { serverUrl, token, serverName })
  },

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
  getLibraryMigrationRules(libraryId) {
    return apiClient.get(`/migration/libraries/${libraryId}/rules`)
  },
  getMigrationStatus() {
    return apiClient.get('/migration/status')
  },
  getMigrationLibraries() {
    return apiClient.get('/migration/libraries')
  },
  migrateAllLibraryRules(libraryId, data) {
    return apiClient.post(`/migration/libraries/${libraryId}/migrate-all`, data)
  },
  analyzeMigrationRule(ruleId) {
    return apiClient.get(`/migration/rules/${ruleId}/analyze`)
  },
  migrateRule(ruleId, data) {
    return apiClient.post(`/migration/rules/${ruleId}/migrate`, data)
  },
  getLibraryRules(id) {
    return apiClient.get(`/libraries/${id}/rules`)
  },
  addLibraryRule(id, data) {
    return apiClient.post(`/libraries/${id}/rules`, data)
  },
  deleteLibraryRule(id, ruleId) {
    return apiClient.delete(`/libraries/${id}/rules/${ruleId}`)
  },
  getRuleSuggestions(id) {
    return apiClient.get(`/libraries/${id}/rules/suggest`)
  },
  getLibraryArrOptions(id) {
    return apiClient.get(`/libraries/${id}/arr-options`)
  },
  updateLibraryArrSettings(id, settings) {
    return apiClient.put(`/libraries/${id}/arr-settings`, { settings })
  },
  getLibraryProfile(libraryId) {
    return apiClient.get(`/libraries/${libraryId}/profile`)
  },
  refreshLibraryProfile(libraryId) {
    return apiClient.post(`/libraries/${libraryId}/profile/refresh`)
  },

  classify(data) {
    return apiClient.post('/classification/classify', data)
  },
  getHistory(params) {
    return apiClient.get('/classification/history', { params })
  },
  submitCorrection(data) {
    return apiClient.post('/classification/corrections', data)
  },
  getStats() {
    return apiClient.get('/classification/stats')
  },
  getClassificationProfile(classificationId) {
    return apiClient.get(`/classification/history/${classificationId}/profile`)
  },
  getClassificationProgress() {
    return apiClient.get('/classification/progress')
  },

  getPolicyStatsOverview() {
    return apiClient.get('/stats/overview')
  },
  getPolicyStatsList() {
    return apiClient.get('/stats/policies')
  },
  getPolicyStatsLiveFeed(limit = 20) {
    return apiClient.get('/stats/live-feed', { params: { limit } })
  },
  getPolicyStatsAlerts() {
    return apiClient.get('/stats/alerts')
  },
  getPolicyStatsDetail(policyId) {
    return apiClient.get(`/stats/policies/${policyId}`)
  },
  getPolicyStatsComparison(policyId) {
    return apiClient.get(`/stats/policies/${policyId}/compare`)
  },
  getPatternConfig() {
    return apiClient.get('/patterns/config')
  },
  updatePatternConfig(config) {
    return apiClient.put('/patterns/config', config)
  },
  getCostSummary() {
    return apiClient.get('/patterns/cost-summary')
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
  getRagStatus() {
    return apiClient.get('/rag/status')
  },
  getRagDetailed(params = {}) {
    return apiClient.get('/rag/detailed', { params })
  },
  getRagTextModels(data = {}) {
    return apiClient.post('/rag/text-models', data)
  },
  getBackfillStatus() {
    return apiClient.get('/rag/backfill/status')
  },
  getBackfillConfig() {
    return apiClient.get('/rag/backfill/config')
  },
  updateBackfillConfig(data) {
    return apiClient.put('/rag/backfill/config', data)
  },
  startManualBackfill(data = {}) {
    return apiClient.post('/rag/backfill/manual/start', data)
  },
  pauseManualBackfill() {
    return apiClient.post('/rag/backfill/manual/pause')
  },
  resumeManualBackfill() {
    return apiClient.post('/rag/backfill/manual/resume')
  },
  clearManualBackfill() {
    return apiClient.post('/rag/backfill/manual/clear')
  },
  testRagConnection(data) {
    return apiClient.post('/rag/test-connection', data)
  },
  resetRagCircuitBreaker() {
    return apiClient.post('/rag/circuit-breaker/reset')
  },
  warmupRagModel() {
    return apiClient.post('/rag/warmup')
  },
  exportRagConfig() {
    return apiClient.post('/rag/export/config')
  },
  exportRagLogs() {
    return apiClient.post('/rag/export/logs')
  },
  exportRagMetrics() {
    return apiClient.post('/rag/export/metrics')
  },
  getLatestRagFallbackIncident() {
    return apiClient.get('/rag/loop/latest-fallback-incident')
  },
  getRagPromotionReadiness() {
    return apiClient.get('/rag/loop/promotion-readiness')
  },
  getRagAdvancedConfig() {
    return apiClient.get('/rag/advanced')
  },
  updateRagAdvancedConfig(data) {
    return apiClient.put('/rag/advanced', data)
  },
  clearRagEmbeddings() {
    return apiClient.post('/rag/clear-embeddings')
  },
  resetRagConfig() {
    return apiClient.post('/rag/reset-config')
  },
  testImageEmbeddingConnection(data) {
    return apiClient.post('/rag/image-test-connection', data)
  },
  getImageModelMetadata(data = {}) {
    return apiClient.post('/rag/image-models-metadata', data)
  },
  getRagGraphFillRate() {
    return apiClient.get('/rag/graph/fill-rate')
  },
  reembedImages() {
    return apiClient.post('/rag/reembed-images')
  },
  getAIUsage() {
    return apiClient.get('/settings/ai/usage')
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

  getQueueStats() {
    return apiClient.get('/queue/stats')
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

  searchTMDB(query, type = 'multi') {
    return apiClient.get('/requests/search', { params: { q: query, type } })
  },
  submitManualRequest(data) {
    return apiClient.post('/requests/submit', data)
  },
  getRecentManualRequests(limit = 10) {
    return apiClient.get('/requests/recent', { params: { limit } })
  },

  getNotifications(params = {}) {
    return apiClient.get('/notifications', { params })
  },
  getActiveNotifications() {
    return apiClient.get('/notifications/active')
  },
  getUnreadNotificationCount() {
    return apiClient.get('/notifications/unread-count')
  },
  markNotificationRead(id) {
    return apiClient.post(`/notifications/${id}/read`)
  },
  markNotificationUnread(id) {
    return apiClient.post(`/notifications/${id}/unread`)
  },
  markAllNotificationsRead() {
    return apiClient.post('/notifications/mark-all-read')
  },
  dismissNotification(id) {
    return apiClient.post(`/notifications/${id}/dismiss`)
  },
  deleteNotification(id) {
    return apiClient.post(`/notifications/${id}/delete`)
  },
  clearReadNotifications() {
    return apiClient.post('/notifications/clear-read')
  },
  clearAllNotifications() {
    return apiClient.post('/notifications/clear-all')
  },

  getSystemHealth() {
    return apiClient.get('/system/health')
  },
  getSystemStatus() {
    return apiClient.get('/system/status')
  },

  getDetailedStats() {
    return apiClient.get('/stats/detailed')
  },

  getSecondPassEvaluation(days = 30) {
    return apiClient.get('/classification/second-pass-evaluation', {
      params: { days }
    })
  },
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

  createBackup(options) {
    return apiClient.post('/backup/export', options)
  },
  listBackups() {
    return apiClient.get('/backup/list')
  },
  downloadBackup(filename) {
    return apiClient.get(`/backup/download/${filename}`, { responseType: 'blob' })
  },
  deleteBackup(filename) {
    return apiClient.delete(`/backup/${filename}`)
  },
  restoreBackup(filename, password, mode) {
    return apiClient.post('/backup/import', { filename, password, mode })
  },
  previewBackupFile(filename, password) {
    return apiClient.post('/backup/preview', { filename, password })
  },

  getQueueSettings() {
    return apiClient.get('/settings/category/queue')
  },
  updateQueueSettings(settings) {
    return apiClient.put('/settings/category/queue', settings)
  },

  getQueuePending(limit = 20) {
    return getPendingQueueRequest(limit).then(r => r.data)
  },
  getQueueFailed(limit = 20) {
    return apiClient.get(`/queue/failed?limit=${limit}`).then(r => r.data)
  },
  retryQueueTask(taskId) {
    return retryQueueTaskRequest(taskId)
  },
  dismissQueueTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/dismiss`)
  },
  cancelQueueTask(taskId) {
    return cancelQueueTaskRequest(taskId)
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

  getLiveStats() {
    return apiClient.get('/queue/live-stats')
  },
  getLiveFeed(limit = 50) {
    return apiClient.get(`/classification/live-feed?limit=${limit}`)
  },
  getPendingClassifications() {
    return apiClient.get('/classification/pending')
  },
  resolvePendingClassification(classificationId, payload) {
    return apiClient.post(`/classification/pending/${classificationId}/resolve`, payload)
  },
  retryClassifications(classificationIds, options = {}) {
    return apiClient.post('/classification/retry', { classificationIds, options })
  },
  getAiGenerationStatus() {
    return apiClient.get('/queue/ollama-status')
  },
  processEnrichmentRetries(options = {}) {
    return apiClient.post('/queue/retry-process', options)
  },

  createReclassificationBatch(items, pauseOnError = true) {
    return apiClient.post('/reclassification/batch', { items, pauseOnError })
  },
  validateReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/validate`)
  },
  executeReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/execute`)
  },
  pauseReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/pause`)
  },
  resumeReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/resume`)
  },
  cancelReclassificationBatch(batchId) {
    return apiClient.post(`/reclassification/batch/${batchId}/cancel`)
  },
  getReclassificationBatchStatus(batchId) {
    return apiClient.get(`/reclassification/batch/${batchId}`)
  },
  skipReclassificationItem(batchId, itemId) {
    return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/skip`)
  },
  retryReclassificationItem(batchId, itemId) {
    return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/retry`)
  },
  getSuggestions(status = 'pending', policyId = null) {
    const params = {}
    if (status) params.status = status
    if (policyId) params.policyId = policyId
    return apiClient.get('/suggestions', { params })
  },
  getSuggestion(id) {
    return apiClient.get(`/suggestions/${id}`)
  },
  applySuggestion(id) {
    return apiClient.post(`/suggestions/${id}/apply`)
  },
  rejectSuggestion(id, reason) {
    return apiClient.post(`/suggestions/${id}/reject`, { reason })
  },
  getApiKeys() {
    return apiClient.get('/keys')
  },
  createApiKey(data) {
    return apiClient.post('/keys', data)
  },
  updateApiKey(id, data) {
    return apiClient.patch(`/keys/${id}`, data)
  },
  deleteApiKey(id) {
    return apiClient.delete(`/keys/${id}`)
  },
  revealApiKey(id) {
    return apiClient.get(`/keys/${id}`)
  },
}
