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

import { describe, expect, it } from 'vitest'

import api from '../../api'

describe('api/index.js barrel export validation', () => {
  function expectFunction(name) {
    expect(typeof api[name], `api.${name} should be a function`).toBe('function')
  }

  describe('inline auth methods', () => {
    it('exposes login, getMe, logout, createAdmin', () => {
      expectFunction('login')
      expectFunction('getMe')
      expectFunction('logout')
      expectFunction('createAdmin')
    })
  })

  describe('mediaServer domain', () => {
    it('exposes mediaServerSetupApi functions', () => {
      expectFunction('getMediaServerConfig')
      expectFunction('getArrConfigStatus')
      expectFunction('getSetupStatus')
      expectFunction('getSetupWizardStatus')
      expectFunction('getHeartbeatSettings')
      expectFunction('updateHeartbeatSettings')
      expectFunction('getSystemHeartbeat')
      expectFunction('updateMediaServerConfig')
      expectFunction('testMediaServerConnection')
      expectFunction('syncMediaServer')
      expectFunction('getMediaServers')
    })

    it('exposes plexApi functions', () => {
      expectFunction('createPlexPin')
      expectFunction('checkPlexPin')
      expectFunction('getPlexServers')
      expectFunction('getPlexUser')
      expectFunction('testPlexConnection')
      expectFunction('savePlexServer')
    })

    it('exposes jellyfinApi functions', () => {
      expectFunction('testJellyfinConnection')
      expectFunction('isJellyfinQuickConnectEnabled')
      expectFunction('initiateJellyfinQuickConnect')
      expectFunction('checkJellyfinQuickConnect')
      expectFunction('authenticateJellyfinQuickConnect')
      expectFunction('authenticateJellyfin')
      expectFunction('saveJellyfinServer')
    })

    it('exposes embyApi functions', () => {
      expectFunction('testEmbyConnection')
      expectFunction('authenticateEmby')
      expectFunction('saveEmbyServer')
    })
  })

  describe('libraries domain', () => {
    it('exposes libraryCatalogApi functions', () => {
      expectFunction('getLibraries')
      expectFunction('getLibrary')
      expectFunction('updateLibrary')
      expectFunction('syncLibrary')
      expectFunction('getSyncStatus')
    })

    it('exposes libraryMigrationApi functions', () => {
      expectFunction('getLibraryMigrationRules')
      expectFunction('getMigrationStatus')
      expectFunction('getMigrationLibraries')
      expectFunction('migrateAllLibraryRules')
      expectFunction('analyzeMigrationRule')
      expectFunction('migrateRule')
    })

    it('exposes libraryRulesApi functions', () => {
      expectFunction('getLibraryRules')
      expectFunction('addLibraryRule')
      expectFunction('deleteLibraryRule')
      expectFunction('getLibraryArrOptions')
      expectFunction('updateLibraryArrSettings')
      expectFunction('getLibraryProfile')
      expectFunction('regenerateLibraryProfile')
    })
  })

  describe('libraryMappings domain', () => {
    it('exposes libraryMappingsApi functions', () => {
      expectFunction('getMappings')
      expectFunction('getUnmappedLibraries')
      expectFunction('getArrInstances')
      expectFunction('autoDetectMappings')
      expectFunction('getRootFolders')
      expectFunction('saveMapping')
      expectFunction('deleteMapping')
    })
  })

  describe('classification domain', () => {
    it('exposes classificationOperations functions', () => {
      expectFunction('classify')
      expectFunction('getHistory')
      expectFunction('submitCorrection')
      expectFunction('getStats')
      expectFunction('getClassificationProfile')
      expectFunction('getClassificationProgress')
      expectFunction('getSecondPassEvaluation')
      expectFunction('getLiveFeed')
      expectFunction('getPendingClassifications')
      expectFunction('getPendingClassificationCount')
      expectFunction('getHistoricRouteSafetyRefreshInventory')
      expectFunction('executeHistoricRouteSafetyRefresh')
      expectFunction('getHistoricRouteSafetyRefreshReceipt')
      expectFunction('resolvePendingClassification')
      expectFunction('rememberResolvedExactItem')
      expectFunction('retryClassifications')
    })

    it('exposes reclassificationBatches functions', () => {
      expectFunction('createReclassificationBatch')
      expectFunction('validateReclassificationBatch')
      expectFunction('executeReclassificationBatch')
      expectFunction('pauseReclassificationBatch')
      expectFunction('resumeReclassificationBatch')
      expectFunction('cancelReclassificationBatch')
      expectFunction('getReclassificationBatchStatus')
      expectFunction('skipReclassificationItem')
      expectFunction('retryReclassificationItem')
    })
  })

  describe('policies domain', () => {
    it('exposes policiesApi functions', () => {
      expectFunction('getPolicy')
      expectFunction('getPolicies')
      expectFunction('getPolicyNativeReadinessSummary')
      expectFunction('createPolicy')
      expectFunction('updatePolicy')
      expectFunction('deletePolicy')
    })
  })

  describe('settings domain', () => {
    it('exposes settingsGeneralApi functions', () => {
      expectFunction('getGeneralSettings')
      expectFunction('updateGeneralSettings')
    })

    it('exposes settingsConfidence functions', () => {
      expectFunction('getConfidenceSettings')
      expectFunction('updateConfidenceSettings')
      expectFunction('getConfidenceHistory')
      expectFunction('revertConfidenceSetting')
      expectFunction('exportConfidenceSettings')
    })

    it('exposes settingsArr functions', () => {
      expectFunction('getRadarrConfig')
      expectFunction('addRadarrConfig')
      expectFunction('updateRadarrConfig')
      expectFunction('deleteRadarrConfig')
      expectFunction('testRadarrConnection')
      expectFunction('getRadarrQualityProfiles')
      expectFunction('getSonarrConfig')
      expectFunction('addSonarrConfig')
      expectFunction('updateSonarrConfig')
      expectFunction('deleteSonarrConfig')
      expectFunction('testSonarrConnection')
      expectFunction('getSonarrQualityProfiles')
    })

    it('exposes settingsNotificationsApi functions', () => {
      expectFunction('getNotificationsConfig')
      expectFunction('updateNotificationsConfig')
      expectFunction('getDiscordChannelDetails')
      expectFunction('getDiscordServers')
      expectFunction('getDiscordChannels')
      expectFunction('getDiscordMentionTargets')
      expectFunction('testDiscord')
    })

    it('exposes settingsPathMappingApi functions', () => {
      expectFunction('getPathMappings')
      expectFunction('createPathMapping')
      expectFunction('deletePathMapping')
      expectFunction('verifyPathMapping')
      expectFunction('verifyAllPathMappings')
      expectFunction('getPathTestHealth')
      expectFunction('testPath')
    })

    it('exposes settingsProviders functions', () => {
      expectFunction('getOllamaConfig')
      expectFunction('updateOllamaConfig')
      expectFunction('testOllama')
      expectFunction('getOllamaModels')
      expectFunction('getLastOllamaPreflight')
      expectFunction('getTMDBConfig')
      expectFunction('updateTMDBConfig')
      expectFunction('testTMDB')
      expectFunction('getSSLConfig')
      expectFunction('updateSSLConfig')
      expectFunction('testSSL')
      expectFunction('getTavilyConfig')
      expectFunction('updateTavilyConfig')
      expectFunction('testTavily')
      expectFunction('getWebSearchProviderConfigs')
      expectFunction('updateWebSearchProviderConfig')
      expectFunction('testWebSearchProvider')
      expectFunction('getOMDbConfig')
      expectFunction('updateOMDbConfig')
      expectFunction('testOMDb')
      expectFunction('getAIConfig')
      expectFunction('getAIConfigForUpdate')
      expectFunction('updateAIConfig')
      expectFunction('testAIConnection')
      expectFunction('runOllamaVerificationCompatibilityMatrix')
      expectFunction('getAIModels')
      expectFunction('getAIUsage')
    })

    it('exposes settingsWebhook functions', () => {
      expectFunction('getWebhookConfig')
      expectFunction('updateWebhookConfig')
      expectFunction('generateWebhookKey')
      expectFunction('getWebhookSecret')
      expectFunction('getWebhookLogs')
      expectFunction('getWebhookStats')
      expectFunction('testWebhook')
      expectFunction('getWebhookConfigs')
      expectFunction('createWebhookConfig')
      expectFunction('deleteWebhookConfig')
      expectFunction('setPrimaryWebhookConfig')
    })
  })

  describe('stats domain', () => {
    it('exposes policyStatsApi functions', () => {
      expectFunction('getPolicyStatsOverview')
      expectFunction('getPolicyStatsList')
      expectFunction('getPolicyStatsLiveFeed')
      expectFunction('getPolicyStatsAlerts')
      expectFunction('getPolicyStatsDetail')
      expectFunction('getPolicyStatsComparison')
      expectFunction('getDetailedStats')
      expectFunction('getCurrentLibraryCandidateRetrievalMetrics')
      expectFunction('getPolicyCandidateContrastiveOutcomeMetrics')
      expectFunction('getPolicyCandidateCorrectionAnalyticsMetrics')
      expectFunction('getRouteSafetyReadiness')
      expectFunction('getAiProviderCapabilityMetricsHealth')
      expectFunction('getRouteSafetyMaintenanceHandoff')
    })

    it('exposes patternStatsApi functions', () => {
      expectFunction('getPatternConfig')
      expectFunction('updatePatternConfig')
      expectFunction('getCostSummary')
    })
  })

  describe('rag domain', () => {
    it('exposes ragStatusApi functions', () => {
      expectFunction('getRagStatus')
      expectFunction('getRagDetailed')
      expectFunction('getLatestRagFallbackIncident')
      expectFunction('getRagPromotionReadiness')
    })

    it('exposes ragTextEmbeddingApi functions', () => {
      expectFunction('getRagTextModels')
      expectFunction('testRagConnection')
    })

    it('exposes ragBackfillApi functions', () => {
      expectFunction('getBackfillStatus')
      expectFunction('getBackfillConfig')
      expectFunction('updateBackfillConfig')
      expectFunction('startManualBackfill')
      expectFunction('pauseManualBackfill')
      expectFunction('resumeManualBackfill')
      expectFunction('clearManualBackfill')
    })

    it('exposes ragAdvancedApi functions', () => {
      expectFunction('resetRagCircuitBreaker')
      expectFunction('warmupRagModel')
      expectFunction('exportRagConfig')
      expectFunction('exportRagLogs')
      expectFunction('exportRagMetrics')
      expectFunction('getRagAdvancedConfig')
      expectFunction('updateRagAdvancedConfig')
      expectFunction('clearRagEmbeddings')
      expectFunction('resetRagConfig')
      expectFunction('updateRetryConfig')
      expectFunction('getRetryConfig')
    })

    it('exposes ragImageEmbeddingApi functions', () => {
      expectFunction('testImageEmbeddingConnection')
      expectFunction('getImageModelMetadata')
      expectFunction('getRagGraphFillRate')
      expectFunction('reembedImages')
    })
  })

  describe('requests domain', () => {
    it('exposes requestsApi functions', () => {
      expectFunction('searchTMDB')
      expectFunction('submitManualRequest')
      expectFunction('getRecentManualRequests')
    })
  })

  describe('notifications domain', () => {
    it('exposes notificationsApi functions', () => {
      expectFunction('getNotifications')
      expectFunction('getActiveNotifications')
      expectFunction('getUnreadNotificationCount')
      expectFunction('markNotificationRead')
      expectFunction('markNotificationUnread')
      expectFunction('markAllNotificationsRead')
      expectFunction('dismissNotification')
      expectFunction('deleteNotification')
      expectFunction('clearReadNotifications')
      expectFunction('clearAllNotifications')
    })
  })

  describe('logs domain', () => {
    it('exposes logsApi functions', () => {
      expectFunction('getLogStats')
      expectFunction('getLogs')
      expectFunction('getLogError')
      expectFunction('getBugReport')
      expectFunction('resolveLogError')
      expectFunction('exportLogs')
      expectFunction('clearAllLogs')
      expectFunction('cleanupLogs')
    })
  })

  describe('ratingNormalization domain', () => {
    it('exposes ratingNormalizationApi functions', () => {
      expectFunction('getRatingNormalizationStats')
      expectFunction('startRatingBackfill')
      expectFunction('finalizeRatingNormalization')
    })
  })

  describe('system domain', () => {
    it('exposes systemHealthApi functions', () => {
      expectFunction('getSystemHealth')
      expectFunction('getSystemStatus')
      expectFunction('refreshSystemHealth')
      expectFunction('resetOmdbCircuitBreaker')
      expectFunction('browseFolders')
    })

    it('exposes schedulerApi functions', () => {
      expectFunction('getScheduledTasks')
      expectFunction('createScheduledTask')
      expectFunction('updateScheduledTask')
      expectFunction('deleteScheduledTask')
      expectFunction('runScheduledTask')
    })

    it('exposes backupApi functions', () => {
      expectFunction('createBackup')
      expectFunction('listBackups')
      expectFunction('downloadBackup')
      expectFunction('deleteBackup')
      expectFunction('restoreBackup')
      expectFunction('previewBackupFile')
    })
  })

  describe('admin domain', () => {
    it('exposes adminSuggestions functions', () => {
      expectFunction('getSuggestions')
      expectFunction('getSuggestion')
      expectFunction('applySuggestion')
      expectFunction('rejectSuggestion')
    })

    it('exposes adminApiKeys functions', () => {
      expectFunction('getApiKeys')
      expectFunction('createApiKey')
      expectFunction('updateApiKey')
      expectFunction('deleteApiKey')
      expectFunction('revealApiKey')
    })
  })

  describe('user domain', () => {
    it('exposes userApi functions', () => {
      expectFunction('getUserProfile')
      expectFunction('updateUserProfile')
      expectFunction('updatePassword')
      expectFunction('getSessionInfo')
    })
  })

  describe('evidence domain', () => {
    it('exposes evidenceQueriesApi functions', () => {
      expectFunction('getSummary')
      expectFunction('list')
      expectFunction('diagnose')
    })

    it('exposes evidenceActionsApi functions', () => {
      expectFunction('decay')
      expectFunction('promote')
      expectFunction('purge')
    })
  })

  describe('queue domain', () => {
    it('exposes queueConfigApi functions', () => {
      expectFunction('getQueueStats')
      expectFunction('getQueueSettings')
      expectFunction('updateQueueSettings')
    })

    it('exposes queueTasksApi functions', () => {
      expectFunction('getQueuePending')
      expectFunction('getQueueFailed')
      expectFunction('retryQueueTask')
      expectFunction('dismissQueueTask')
      expectFunction('cancelQueueTask')
      expectFunction('classifyQueueTask')
    })

    it('exposes queueOperationsApi functions', () => {
      expectFunction('clearCompletedTasks')
      expectFunction('clearFailedTasks')
      expectFunction('retryAllFailedTasks')
      expectFunction('cancelAllPendingTasks')
      expectFunction('reprocessCompleted')
      expectFunction('clearAndResync')
      expectFunction('getLiveStats')
      expectFunction('getAiGenerationStatus')
      expectFunction('processEnrichmentRetries')
      expectFunction('getGapAnalysisStats')
    })
  })

  describe('no raw passthrough methods', () => {
    it('does not expose get, getData, post, put, patch, delete', () => {
      expect(api.get).toBeUndefined()
      expect(api.getData).toBeUndefined()
      expect(api.post).toBeUndefined()
      expect(api.put).toBeUndefined()
      expect(api.patch).toBeUndefined()
      expect(api.delete).toBeUndefined()
    })

    it('does not expose getSettings or updateSettings', () => {
      expect(api.getSettings).toBeUndefined()
      expect(api.updateSettings).toBeUndefined()
    })
  })
})
