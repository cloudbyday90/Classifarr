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

const REFRESH_TOKEN_KEY = 'classifarr_refresh_token'
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

function getRefreshToken() {
  const stored = sessionStorage.getItem(REFRESH_TOKEN_KEY)
  return stored || null
}

function setRefreshToken(token) {
  if (token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  }
}

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  
  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  if (refreshInProgress) {
    return refreshInProgress
  }

  refreshInProgress = (async () => {
    try {
      const csrfToken = getCsrfToken()
      const response = await axios.post('/api/auth/refresh', {
        refreshToken
      }, {
        withCredentials: true,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
      })

      if (response.data.refreshToken) {
        setRefreshToken(response.data.refreshToken)
      }

      return response
    } catch (error) {
      setRefreshToken(null)
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
      setRefreshToken(null)
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=true'
      }
      
      return Promise.reject(error)
    }
  }

  if (error.response?.status === 401) {
    setRefreshToken(null)
    
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?expired=true'
    }
  }

  return Promise.reject(error)
  }
)

export default {
  login(identifier, password) {
    return apiClient.post('/auth/login', { identifier, password }).then(response => {
      if (response.data.refreshToken) {
        setRefreshToken(response.data.refreshToken)
      }
      return response
    })
  },

  logout() {
    const refreshToken = getRefreshToken()
    setRefreshToken(null)
    return apiClient.post('/auth/logout', { refreshToken })
  },

  logoutAll() {
    setRefreshToken(null)
    return apiClient.post('/auth/logout-all')
  },

  getMe() {
    return apiClient.get('/auth/me')
  },

  getSessions() {
    return apiClient.get('/auth/sessions')
  },

  revokeSession(sessionId) {
    return apiClient.delete(`/auth/sessions/${sessionId}`)
  },

  changePassword(currentPassword, newPassword, confirmPassword) {
    return apiClient.post('/auth/change-password', { currentPassword, newPassword, confirmPassword })
  },

  getSessionInfo() {
    return apiClient.get('/auth/session')
  },

  clearAuth() {
    setRefreshToken(null)
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
    if (category) {
      return apiClient.get(`/settings/category/${category}`)
    }
    return apiClient.get('/settings')
  },
  updateSettings(categoryOrSettings, settings = null) {
    if (settings !== null && typeof categoryOrSettings === 'string') {
      return apiClient.put(`/settings/category/${categoryOrSettings}`, settings)
    }
    return apiClient.put('/settings', categoryOrSettings)
  },

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
  verifyEmbyToken(serverUrl, token) {
    return apiClient.post('/emby/verify', { serverUrl, token })
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
  deleteLibraryRule(id, ruleId) {
    return apiClient.delete(`/libraries/${id}/rules/${ruleId}`)
  },
  getRuleSuggestions(id) {
    return apiClient.get(`/libraries/${id}/rules/suggest`)
  },
  getPendingSuggestions() {
    return apiClient.get('/libraries/pending-suggestions')
  },
  dismissSuggestions(libraryId) {
    return apiClient.post(`/libraries/${libraryId}/dismiss-suggestions`)
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
  getClassification(id) {
    return apiClient.get(`/classification/history/${id}`)
  },
  submitCorrection(data) {
    return apiClient.post('/classification/corrections', data)
  },
  getStats() {
    return apiClient.get('/classification/stats')
  },
  getClassificationProgress() {
    return apiClient.get('/classification/progress')
  },

  getPatterns(params) {
    return apiClient.get('/patterns', { params })
  },
  getPattern(id) {
    return apiClient.get(`/patterns/${id}`)
  },
  getLibraryPatterns(libraryId) {
    return apiClient.get(`/patterns/library/${libraryId}`)
  },
  getPatternSummary() {
    return apiClient.get('/patterns/summary')
  },
  getPatternConfig() {
    return apiClient.get('/patterns/config')
  },
  updatePatternConfig(config) {
    return apiClient.put('/patterns/config', config)
  },
  approvePattern(id, data) {
    return apiClient.put(`/patterns/${id}/approve`, data)
  },
  rejectPattern(id, data) {
    return apiClient.put(`/patterns/${id}/reject`, data)
  },
  deletePattern(id) {
    return apiClient.delete(`/patterns/${id}`)
  },
  discoverPatterns() {
    return apiClient.post('/patterns/discover')
  },
  discoverLibraryPatterns(libraryId) {
    return apiClient.post(`/patterns/discover/${libraryId}`)
  },
  resolveConflicts() {
    return apiClient.post('/patterns/resolve-conflicts')
  },
  getCostSummary() {
    return apiClient.get('/patterns/cost-summary')
  },

  getSettings() {
    return apiClient.get('/settings')
  },
  updateSettings(data) {
    return apiClient.put('/settings', data)
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
  getRadarrRootFolders(id) {
    return apiClient.get(`/settings/radarr/${id}/root-folders`)
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
  getSonarrRootFolders(id) {
    return apiClient.get(`/settings/sonarr/${id}/root-folders`)
  },
  getSonarrQualityProfiles(id) {
    return apiClient.get(`/settings/sonarr/${id}/quality-profiles`)
  },

  getOllamaConfig() {
    return apiClient.get('/settings/ollama')
  },
  updateOllamaConfig(data) {
    return apiClient.put('/settings/ollama', data)
  },
  testOllama(host, port) {
    return apiClient.post('/settings/ollama/test', { host, port })
  },
  getOllamaModels(host, port) {
    return apiClient.get('/settings/ollama/models', { params: { host, port } })
  },

  getTMDBConfig() {
    return apiClient.get('/settings/tmdb')
  },
  updateTMDBConfig(data) {
    return apiClient.put('/settings/tmdb', data)
  },

  getNotificationConfig() {
    return apiClient.get('/settings/notifications')
  },
  updateNotificationConfig(data) {
    return apiClient.put('/settings/notifications', data)
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
  testTavilySearch(data) {
    return apiClient.post('/settings/tavily/search', data)
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
  testOMDbSearch(data) {
    return apiClient.post('/settings/omdb/search', data)
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
  getRagEmbeddingModels(data) {
    return apiClient.post('/rag/embedding-models', data)
  },
  testImageEmbeddingConnection(data) {
    return apiClient.post('/rag/image-test-connection', data)
  },
  getImageEmbeddingModelsCache() {
    return apiClient.get('/rag/image-models-cache')
  },
  getImageEmbeddingLocalModels(host, port) {
    return apiClient.get('/rag/image-models', { params: { host, port } })
  },
  reembedImages() {
    return apiClient.post('/rag/reembed-images')
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

  getWebhookConfigs() {
    return apiClient.get('/settings/webhook/configs')
  },
  getWebhookConfigById(id) {
    return apiClient.get(`/settings/webhook/configs/${id}`)
  },
  createWebhookConfig(config) {
    return apiClient.post('/settings/webhook/configs', config)
  },
  updateWebhookSourceConfig(id, config) {
    return apiClient.put(`/settings/webhook/configs/${id}`, config)
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
  clearReadNotifications() {
    return apiClient.post('/notifications/clear-read')
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
  getDailyStats(days = 30) {
    return apiClient.get('/stats/daily', { params: { days } })
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
    return apiClient.get(`/queue/pending?limit=${limit}`).then(r => r.data)
  },
  getQueueFailed(limit = 20) {
    return apiClient.get(`/queue/failed?limit=${limit}`).then(r => r.data)
  },
  retryQueueTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/retry`)
  },
  dismissQueueTask(taskId) {
    return apiClient.post(`/queue/task/${taskId}/dismiss`)
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
  getOllamaStatus() {
    return apiClient.get('/queue/ollama-status')
  },

  getRetryStats() {
    return apiClient.get('/queue/retry-stats')
  },
  processRetryQueue(options = {}) {
    return apiClient.post('/queue/retry-process', options)
  },
  backfillRetryQueue() {
    return apiClient.post('/queue/retry-backfill')
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
  getReclassificationBatchProgress(batchId) {
    return apiClient.get(`/reclassification/batch/${batchId}/progress`)
  },
  skipReclassificationItem(batchId, itemId) {
    return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/skip`)
  },
  retryReclassificationItem(batchId, itemId) {
    return apiClient.post(`/reclassification/batch/${batchId}/item/${itemId}/retry`)
  },
  listReclassificationBatches(limit = 20) {
    return apiClient.get(`/reclassification/batches?limit=${limit}`)
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
  getSuggestionImpact(id) {
    return apiClient.get(`/suggestions/${id}/impact`)
  },
  getPolicySuggestionsSummary(policyId) {
    return apiClient.get(`/suggestions/policy/${policyId}/summary`)
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
