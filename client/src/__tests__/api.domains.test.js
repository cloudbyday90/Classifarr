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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('axios', () => {
  const instance = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }

  return {
    default: {
      ...instance,
      create: vi.fn(() => instance),
      post: vi.fn(),
    },
    create: vi.fn(() => instance),
    post: vi.fn(),
    interceptors: instance.interceptors,
  }
})

import api from '../api'
import adminApi from '../api/admin'
import classificationApi from '../api/classification'
import evidenceApi from '../api/evidence'
import librariesApi from '../api/libraries'
import mediaServerApi from '../api/mediaServer'
import queueApi from '../api/queue'
import ragApi from '../api/rag'
import requestsNotificationsApi from '../api/requestsNotifications'
import settingsApi from '../api/settings'
import statsApi from '../api/stats'
import systemApi from '../api/system'
import axios from 'axios'

const apiClient = axios.create()

describe('api domain modules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps queue helpers on the default API export and preserves data unwrapping', async () => {
    apiClient.get.mockResolvedValueOnce({ data: ['task-a', 'task-b'] })

    await expect(api.getQueuePending(25)).resolves.toEqual(['task-a', 'task-b'])
    expect(apiClient.get).toHaveBeenCalledWith('/queue/pending', { params: { limit: 25 } })

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.processEnrichmentRetries({ limit: 10, enrichmentType: 'tavily' }))
      .resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/queue/retry-process', {
      limit: 10,
      enrichmentType: 'tavily',
    })

    expect(queueApi.getQueuePending).toBe(api.getQueuePending)
    expect(queueApi.processEnrichmentRetries).toBe(api.processEnrichmentRetries)
  })

  it('normalizes operational queue and classification reads to data objects', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { pending: 3 } })

    await expect(api.getLiveStats()).resolves.toEqual({ pending: 3 })
    expect(apiClient.get).toHaveBeenCalledWith('/queue/live-stats', undefined)

    apiClient.get.mockResolvedValueOnce({ data: { isActive: true } })

    await expect(queueApi.getAiGenerationStatus()).resolves.toEqual({ isActive: true })
    expect(apiClient.get).toHaveBeenCalledWith('/queue/ollama-status', undefined)

    apiClient.get.mockResolvedValueOnce({ data: { progress: 42 } })

    await expect(classificationApi.getClassificationProgress()).resolves.toEqual({ progress: 42 })
    expect(apiClient.get).toHaveBeenCalledWith('/classification/progress', undefined)

    apiClient.get.mockResolvedValueOnce({ data: { items: [{ id: 1 }] } })

    await expect(api.getPendingClassifications()).resolves.toEqual({ items: [{ id: 1 }] })
    expect(apiClient.get).toHaveBeenCalledWith('/classification/pending', undefined)
  })

  it('keeps rag helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { status: 'ok' } })

    await expect(ragApi.getRagStatus()).resolves.toEqual({ data: { status: 'ok' } })
    expect(apiClient.get).toHaveBeenCalledWith('/rag/status')

    apiClient.post.mockResolvedValueOnce({ data: { models: [] } })

    await expect(api.getRagTextModels({ provider: 'cloud' })).resolves.toEqual({ data: { models: [] } })
    expect(apiClient.post).toHaveBeenCalledWith('/rag/text-models', { provider: 'cloud' })

    expect(ragApi.getRagStatus).toBe(api.getRagStatus)
    expect(ragApi.getRagTextModels).toBe(api.getRagTextModels)
  })

  it('keeps evidence helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { total: 12, byScope: {} } })

    await expect(api.getSummary()).resolves.toEqual({ total: 12, byScope: {} })
    expect(apiClient.get).toHaveBeenCalledWith('/evidence/summary', undefined)

    apiClient.get.mockResolvedValueOnce({ data: { rows: [{ id: 9 }], total: 1 } })

    await expect(evidenceApi.list({ status: 'active', limit: 10 })).resolves.toEqual({
      rows: [{ id: 9 }],
      total: 1,
    })
    expect(apiClient.get).toHaveBeenCalledWith('/evidence', {
      params: { status: 'active', limit: 10 },
    })

    apiClient.post.mockResolvedValueOnce({ data: { changed: true } })

    await expect(api.decay(44)).resolves.toEqual({ data: { changed: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/evidence/44/decay')

    apiClient.post.mockResolvedValueOnce({ data: { deleted: 3 } })

    await expect(evidenceApi.purge({ scope: 'library' })).resolves.toEqual({ data: { deleted: 3 } })
    expect(apiClient.post).toHaveBeenCalledWith('/evidence/purge', { scope: 'library' })

    expect(evidenceApi.getSummary).toBe(api.getSummary)
    expect(evidenceApi.list).toBe(api.list)
    expect(evidenceApi.decay).toBe(api.decay)
    expect(evidenceApi.purge).toBe(api.purge)
  })

  it('keeps library and migration helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [{ id: 1, name: 'Movies' }] })

    await expect(api.getLibraries()).resolves.toEqual([{ id: 1, name: 'Movies' }])
    expect(apiClient.get).toHaveBeenCalledWith('/libraries', undefined)

    apiClient.get.mockResolvedValueOnce({ data: { pending: 3 } })

    await expect(librariesApi.getMigrationStatus()).resolves.toEqual({ pending: 3 })
    expect(apiClient.get).toHaveBeenCalledWith('/migration/status', undefined)

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(librariesApi.migrateRule(44, { libraryId: 2 })).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/migration/rules/44/migrate', { libraryId: 2 })

    apiClient.put.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.updateLibraryArrSettings(7, { arrType: 'radarr' })).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.put).toHaveBeenCalledWith('/libraries/7/arr-settings', { settings: { arrType: 'radarr' } })

    expect(librariesApi.getLibraries).toBe(api.getLibraries)
    expect(librariesApi.migrateRule).toBe(api.migrateRule)
    expect(librariesApi.updateLibraryArrSettings).toBe(api.updateLibraryArrSettings)
  })

  it('keeps media-server onboarding helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { id: 5, name: 'Primary Server' } })

    await expect(api.getMediaServers()).resolves.toEqual([{ id: 5, name: 'Primary Server' }])
    expect(apiClient.get).toHaveBeenCalledWith('/media-server', undefined)

    apiClient.get.mockResolvedValueOnce({ data: { setupRequired: true } })

    await expect(mediaServerApi.getSetupStatus()).resolves.toEqual({ setupRequired: true })
    expect(apiClient.get).toHaveBeenCalledWith('/setup/status', undefined)

    apiClient.post.mockResolvedValueOnce({ data: { pin: '1234' } })

    await expect(mediaServerApi.createPlexPin()).resolves.toEqual({ data: { pin: '1234' } })
    expect(apiClient.post).toHaveBeenCalledWith('/plex/pin')

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.authenticateJellyfin('http://jf', 'user', 'pass')).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/jellyfin/authenticate', {
      serverUrl: 'http://jf',
      username: 'user',
      password: 'pass',
    })

    apiClient.put.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.updateHeartbeatSettings({ intervalMinutes: 5 })).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.put).toHaveBeenCalledWith('/settings/heartbeat', { intervalMinutes: 5 })

    expect(mediaServerApi.getMediaServers).toBe(api.getMediaServers)
    expect(mediaServerApi.createPlexPin).toBe(api.createPlexPin)
    expect(mediaServerApi.authenticateJellyfin).toBe(api.authenticateJellyfin)
    expect(mediaServerApi.updateHeartbeatSettings).toBe(api.updateHeartbeatSettings)
  })

  it('keeps classification and reclassification helpers available from both the module and the default API export', async () => {
    apiClient.post.mockResolvedValueOnce({ data: { status: 'queued' } })

    await expect(api.classify({ tmdbId: 7 })).resolves.toEqual({ data: { status: 'queued' } })
    expect(apiClient.post).toHaveBeenCalledWith('/classification/classify', { tmdbId: 7 })

    apiClient.get.mockResolvedValueOnce({ data: [] })

    await expect(api.getSecondPassEvaluation(14)).resolves.toEqual({ data: [] })
    expect(apiClient.get).toHaveBeenCalledWith('/classification/second-pass-evaluation', {
      params: { days: 14 },
    })

    apiClient.post.mockResolvedValueOnce({ data: { batchId: 12 } })

    await expect(classificationApi.createReclassificationBatch([{ id: 9 }], false))
      .resolves.toEqual({ data: { batchId: 12 } })
    expect(apiClient.post).toHaveBeenCalledWith('/reclassification/batch', {
      items: [{ id: 9 }],
      pauseOnError: false,
    })

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.resolvePendingClassification(55, { action: 'accept' }))
      .resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/classification/pending/55/resolve', {
      action: 'accept',
    })

    expect(classificationApi.classify).toBe(api.classify)
    expect(classificationApi.getClassificationProgress).toBe(api.getClassificationProgress)
    expect(classificationApi.getSecondPassEvaluation).toBe(api.getSecondPassEvaluation)
    expect(classificationApi.createReclassificationBatch).toBe(api.createReclassificationBatch)
    expect(classificationApi.resolvePendingClassification).toBe(api.resolvePendingClassification)
  })

  it('keeps settings and provider-admin helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { enabled: true } })

    await expect(api.getConfidenceSettings()).resolves.toEqual({ data: { enabled: true } })
    expect(apiClient.get).toHaveBeenCalledWith('/settings/confidence')

    apiClient.put.mockResolvedValueOnce({ data: { ok: true } })

    await expect(settingsApi.updateTavilyConfig({ apiKey: 'abc' })).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.put).toHaveBeenCalledWith('/settings/tavily', { apiKey: 'abc' })

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.testOllama('http://ollama', 11434)).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/settings/ollama/test', {
      host: 'http://ollama',
      port: 11434,
    })

    apiClient.get.mockResolvedValueOnce({ data: [{ id: 1 }] })

    await expect(settingsApi.getWebhookLogs({ limit: 25 })).resolves.toEqual({ data: [{ id: 1 }] })
    expect(apiClient.get).toHaveBeenCalledWith('/settings/webhook/logs', {
      params: { limit: 25 },
    })

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.setPrimaryWebhookConfig(7)).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/settings/webhook/configs/7/primary')

    apiClient.get.mockResolvedValueOnce({ data: { budget: { used: 1 } } })

    await expect(api.getAIUsage()).resolves.toEqual({ budget: { used: 1 } })
    expect(apiClient.get).toHaveBeenCalledWith('/settings/ai/usage', undefined)

    expect(settingsApi.getConfidenceSettings).toBe(api.getConfidenceSettings)
    expect(settingsApi.updateTavilyConfig).toBe(api.updateTavilyConfig)
    expect(settingsApi.testOllama).toBe(api.testOllama)
    expect(settingsApi.getWebhookLogs).toBe(api.getWebhookLogs)
    expect(settingsApi.setPrimaryWebhookConfig).toBe(api.setPrimaryWebhookConfig)
    expect(settingsApi.getAIUsage).toBe(api.getAIUsage)
  })

  it('keeps stats and pattern helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { total: 5 } })

    await expect(api.getPolicyStatsOverview()).resolves.toEqual({ total: 5 })
    expect(apiClient.get).toHaveBeenCalledWith('/stats/overview', undefined)

    apiClient.get.mockResolvedValueOnce({ data: [{ id: 'p1' }] })

    await expect(statsApi.getPolicyStatsLiveFeed(15)).resolves.toEqual([{ id: 'p1' }])
    expect(apiClient.get).toHaveBeenCalledWith('/stats/live-feed', { params: { limit: 15 } })

    apiClient.put.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.updatePatternConfig({ enabled: true })).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.put).toHaveBeenCalledWith('/patterns/config', { enabled: true })

    apiClient.get.mockResolvedValueOnce({ data: { cost: 12.5 } })

    await expect(statsApi.getCostSummary()).resolves.toEqual({ cost: 12.5 })
    expect(apiClient.get).toHaveBeenCalledWith('/patterns/cost-summary', undefined)

    expect(statsApi.getPolicyStatsOverview).toBe(api.getPolicyStatsOverview)
    expect(statsApi.getPolicyStatsLiveFeed).toBe(api.getPolicyStatsLiveFeed)
    expect(statsApi.updatePatternConfig).toBe(api.updatePatternConfig)
    expect(statsApi.getCostSummary).toBe(api.getCostSummary)
  })

  it('keeps request and notification helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [{ id: 7 }] })

    await expect(api.searchTMDB('matrix', 'movie')).resolves.toEqual([{ id: 7 }])
    expect(apiClient.get).toHaveBeenCalledWith('/requests/search', {
      params: { q: 'matrix', type: 'movie' },
    })

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(requestsNotificationsApi.submitManualRequest({ tmdbId: 10 }))
      .resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/requests/submit', { tmdbId: 10 })

    apiClient.get.mockResolvedValueOnce({ data: { data: [{ id: 4 }], unreadCount: 1, pagination: { page: 1, totalPages: 1 } } })

    await expect(api.getNotifications({ unread: true })).resolves.toEqual({
      data: [{ id: 4 }],
      unreadCount: 1,
      pagination: { page: 1, totalPages: 1 },
    })
    expect(apiClient.get).toHaveBeenCalledWith('/notifications', { params: { unread: true } })

    apiClient.get.mockResolvedValueOnce({ data: { unread: 3 } })

    await expect(requestsNotificationsApi.getUnreadNotificationCount()).resolves.toEqual({ unread: 3 })
    expect(apiClient.get).toHaveBeenCalledWith('/notifications/unread-count', undefined)

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(requestsNotificationsApi.clearAllNotifications()).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/notifications/clear-all')

    expect(requestsNotificationsApi.searchTMDB).toBe(api.searchTMDB)
    expect(requestsNotificationsApi.submitManualRequest).toBe(api.submitManualRequest)
    expect(requestsNotificationsApi.getNotifications).toBe(api.getNotifications)
    expect(requestsNotificationsApi.clearAllNotifications).toBe(api.clearAllNotifications)
  })

  it('keeps system, scheduler, and backup helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { ok: true } })

    await expect(api.getSystemHealth()).resolves.toEqual({ ok: true })
    expect(apiClient.get).toHaveBeenCalledWith('/system/health', undefined)

    apiClient.post.mockResolvedValueOnce({ data: { id: 2 } })

    await expect(systemApi.createScheduledTask({ name: 'nightly' })).resolves.toEqual({ data: { id: 2 } })
    expect(apiClient.post).toHaveBeenCalledWith('/scheduler', { name: 'nightly' })

    apiClient.get.mockResolvedValueOnce({ data: ['backup.zip'] })

    await expect(api.listBackups()).resolves.toEqual(['backup.zip'])
    expect(apiClient.get).toHaveBeenCalledWith('/backup/list', undefined)

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(systemApi.previewBackupFile('backup.zip', 'secret')).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/backup/preview', {
      filename: 'backup.zip',
      password: 'secret',
    })

    expect(systemApi.getSystemHealth).toBe(api.getSystemHealth)
    expect(systemApi.createScheduledTask).toBe(api.createScheduledTask)
    expect(systemApi.listBackups).toBe(api.listBackups)
    expect(systemApi.previewBackupFile).toBe(api.previewBackupFile)
  })

  it('keeps suggestion and API-key helpers available from both the module and the default API export', async () => {
    apiClient.get.mockResolvedValueOnce({ data: [{ id: 3 }] })

    await expect(api.getSuggestions('pending', 9)).resolves.toEqual([{ id: 3 }])
    expect(apiClient.get).toHaveBeenCalledWith('/suggestions', {
      params: { status: 'pending', policyId: 9 },
    })

    apiClient.post.mockResolvedValueOnce({ data: { ok: true } })

    await expect(adminApi.rejectSuggestion(12, 'bad fit')).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.post).toHaveBeenCalledWith('/suggestions/12/reject', { reason: 'bad fit' })

    apiClient.post.mockResolvedValueOnce({ data: { id: 4 } })

    await expect(api.createApiKey({ name: 'automation' })).resolves.toEqual({ data: { id: 4 } })
    expect(apiClient.post).toHaveBeenCalledWith('/keys', { name: 'automation' })

    apiClient.patch.mockResolvedValueOnce({ data: { ok: true } })

    await expect(adminApi.updateApiKey(8, { active: false })).resolves.toEqual({ data: { ok: true } })
    expect(apiClient.patch).toHaveBeenCalledWith('/keys/8', { active: false })

    apiClient.get.mockResolvedValueOnce({ data: [{ id: 8, name: 'automation' }] })

    await expect(adminApi.getApiKeys()).resolves.toEqual([{ id: 8, name: 'automation' }])
    expect(apiClient.get).toHaveBeenCalledWith('/keys', undefined)

    expect(adminApi.getSuggestions).toBe(api.getSuggestions)
    expect(adminApi.rejectSuggestion).toBe(api.rejectSuggestion)
    expect(adminApi.createApiKey).toBe(api.createApiKey)
    expect(adminApi.updateApiKey).toBe(api.updateApiKey)
  })
})
