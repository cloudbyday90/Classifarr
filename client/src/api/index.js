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
  getMediaServer() {
    return apiClient.get('/media-server')
  },
  saveMediaServer(data) {
    return apiClient.post('/media-server', data)
  },
  testMediaServer(data) {
    return apiClient.post('/media-server/test', data)
  },
  syncMediaServer() {
    return apiClient.post('/media-server/sync')
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
    return apiClient.put(`/libraries/${id}/arr-settings`, settings)
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
  getRadarrConfigs() {
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
  testRadarr(data) {
    return apiClient.post('/settings/radarr/test', data)
  },
  getRadarrRootFolders(id) {
    return apiClient.get(`/settings/radarr/${id}/root-folders`)
  },
  getRadarrQualityProfiles(id) {
    return apiClient.get(`/settings/radarr/${id}/quality-profiles`)
  },

  // Sonarr
  getSonarrConfigs() {
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
  testSonarr(data) {
    return apiClient.post('/settings/sonarr/test', data)
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
}
