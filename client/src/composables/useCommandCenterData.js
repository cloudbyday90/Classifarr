/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { computed } from 'vue'
import api from '@/api'
import { useSWR } from '@/composables/useSWR'
import { CACHE_TTL, POLL_INTERVALS } from '@/constants/cacheKeys'

export function useCommandCenterData({ router }) {
  function getOperationalPollInterval() {
    return isOperationallyActive.value ? POLL_INTERVALS.FAST : POLL_INTERVALS.NORMAL
  }

  function getSecondaryPollInterval() {
    return isOperationallyActive.value ? POLL_INTERVALS.NORMAL : POLL_INTERVALS.SLOW
  }

  const { data: liveStatsData, isStale: liveStatsStale, refresh: refreshLiveStats, cacheTimestamp: liveStatsTimestamp } = useSWR(
    'command-center:live-stats',
    async () => (await api.getLiveStats()) ?? {},
    { ttl: CACHE_TTL.SHORT, pollInterval: getOperationalPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: progressData, isStale: progressStale, refresh: refreshProgressData, cacheTimestamp: progressTimestamp } = useSWR(
    'command-center:progress',
    async () => (await api.getClassificationProgress()) ?? [],
    { ttl: CACHE_TTL.SHORT, pollInterval: getOperationalPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: pendingTasksData, isStale: pendingTasksStale, refresh: refreshPendingTasks, cacheTimestamp: pendingTasksTimestamp } = useSWR(
    'command-center:pending-tasks',
    async () => await api.getQueuePending(20),
    { ttl: CACHE_TTL.SHORT, pollInterval: getOperationalPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: failedTasksData, isStale: failedTasksStale, refresh: refreshFailedTasks, cacheTimestamp: failedTasksTimestamp } = useSWR(
    'command-center:failed-tasks',
    async () => await api.getQueueFailed(20),
    { ttl: CACHE_TTL.SHORT, pollInterval: getOperationalPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: pendingClassificationData, isStale: pendingClassificationsStale, refresh: refreshPendingClassifications, cacheTimestamp: pendingClassificationsTimestamp } = useSWR(
    'command-center:pending-classifications',
    async () => (await api.getPendingClassifications()) ?? { items: [] },
    { ttl: CACHE_TTL.SHORT, pollInterval: getOperationalPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: aiGenerationStatusData, isStale: aiGenerationStatusStale, refresh: refreshAiGenerationStatus, cacheTimestamp: aiGenerationStatusTimestamp } = useSWR(
    'command-center:ai-generation-status',
    async () => (await api.getAiGenerationStatus()) ?? { isActive: false },
    { ttl: CACHE_TTL.SHORT, pollInterval: getOperationalPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: aiUsageData, isStale: aiUsageStale, refresh: refreshAiUsage, cacheTimestamp: aiUsageTimestamp } = useSWR(
    'command-center:ai-usage',
    async () => (await api.getAIUsage()) ?? { budget: { limit: null, used: 0, percentUsed: 0 } },
    { ttl: CACHE_TTL.MEDIUM, pollInterval: getSecondaryPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: librariesData, refresh: refreshLibraries, cacheTimestamp: librariesTimestamp } = useSWR(
    'command-center:libraries',
    async () => await api.getLibraries() ?? [],
    { ttl: CACHE_TTL.LONG, pollInterval: POLL_INTERVALS.SLOW, pollOnlyWhenVisible: true }
  )

  const { data: liveFeedData, isStale: liveFeedStale, refresh: refreshLiveFeed, cacheTimestamp: liveFeedTimestamp } = useSWR(
    'command-center:live-feed',
    async () => (await api.getLiveFeed(250)) ?? { items: [] },
    { ttl: CACHE_TTL.SHORT, pollInterval: getOperationalPollInterval, pollOnlyWhenVisible: true }
  )

  const { data: mediaServerConfigData, isStale: mediaServerConfigStale, refresh: refreshMediaServerConfig, cacheTimestamp: mediaServerConfigTimestamp } = useSWR(
    'command-center:media-server-config',
    async () => (await api.getMediaServerConfig()) ?? null,
    { ttl: CACHE_TTL.LONG, pollInterval: POLL_INTERVALS.SLOW, pollOnlyWhenVisible: true }
  )

  const { data: arrConfigStatusData, isStale: arrConfigStatusStale, refresh: refreshArrConfigStatus, cacheTimestamp: arrConfigStatusTimestamp } = useSWR(
    'command-center:arr-config-status',
    async () => (await api.getArrConfigStatus()) ?? { incompleteConfigs: [] },
    { ttl: CACHE_TTL.LONG, pollInterval: POLL_INTERVALS.SLOW, pollOnlyWhenVisible: true }
  )

  const isAnyDataStale = computed(() => (
    liveStatsStale.value
    || progressStale.value
    || pendingTasksStale.value
    || failedTasksStale.value
    || pendingClassificationsStale.value
    || aiGenerationStatusStale.value
    || aiUsageStale.value
    || liveFeedStale.value
    || mediaServerConfigStale.value
    || arrConfigStatusStale.value
  ))

  const liveStats = computed(() => liveStatsData.value || {})
  const queueStats = computed(() => liveStats.value.queue || {})
  const gapStats = computed(() => liveStats.value.gapAnalysis || {})
  const enrichmentStats = computed(() => liveStats.value.enrichment || {})
  const healthStats = computed(() => liveStats.value.health || {})
  const todayStats = computed(() => liveStats.value.today || {})
  const queuePendingCount = computed(() => Number(queueStats.value.pending || 0))
  const gapProcessedCount = computed(() => Number(gapStats.value.processedCount ?? gapStats.value.processedItems ?? 0))
  const gapTotalCount = computed(() => Number(gapStats.value.totalCount ?? gapStats.value.totalItems ?? 0))
  const gapPercentComplete = computed(() => Number(gapStats.value.percentComplete ?? gapStats.value.progressPercent ?? 0))

  const activeProcessingTasks = computed(() => Array.isArray(progressData.value) ? progressData.value : [])
  const primaryActiveTask = computed(() => activeProcessingTasks.value[0] || null)
  const pendingQueueTasks = computed(() => (
    Array.isArray(pendingTasksData.value) ? pendingTasksData.value : []
  ).filter(task => task.status === 'pending' && task.task_type === 'classification'))
  const upNextTasks = computed(() => pendingQueueTasks.value.slice(0, 3))
  const upNextCount = computed(() => pendingQueueTasks.value.length)
  const failedQueueTasks = computed(() => Array.isArray(failedTasksData.value) ? failedTasksData.value : [])
  const needsAttentionItems = computed(() => Array.isArray(pendingClassificationData.value?.items) ? pendingClassificationData.value.items : [])
  const aiGenerationStatus = computed(() => aiGenerationStatusData.value || { isActive: false })
  const aiBudget = computed(() => aiUsageData.value?.budget || { limit: null, used: 0, percentUsed: 0 })
  const enrichmentTotal = computed(() => Number(enrichmentStats.value.totalItems || 0))
  const enrichmentEnriched = computed(() => Number(enrichmentStats.value.enriched || 0))
  const enrichmentOmdb = computed(() => Number(enrichmentStats.value.omdbEnriched || 0))
  const enrichmentOmdbPending = computed(() => Number(enrichmentStats.value.retryQueue?.omdb?.pending || 0))
  const enrichmentTavily = computed(() => Number(enrichmentStats.value.tavilyEnriched || 0))
  const enrichmentTavilyPending = computed(() => Number(enrichmentStats.value.retryQueue?.tavily?.pending || 0))
  const enrichmentProgress = computed(() => Number(enrichmentStats.value.progress || 0))
  const hasEnrichmentRetryPending = computed(() => enrichmentOmdbPending.value > 0 || enrichmentTavilyPending.value > 0)
  const showEnrichmentSection = computed(() => (enrichmentTotal.value > 0 && enrichmentProgress.value < 100) || hasEnrichmentRetryPending.value)
  const activeLibraries = computed(() => (Array.isArray(librariesData.value) ? librariesData.value : []).filter(library => library?.is_active !== false))
  const liveFeedItems = computed(() => (Array.isArray(liveFeedData.value?.items) ? liveFeedData.value.items : []))
  const recentlyCompletedItems = computed(() => liveFeedItems.value.slice(0, 5))

  const todayClassifiedCount = computed(() => Number(todayStats.value.classified || 0))
  const todayAvgConfidence = computed(() => Number(todayStats.value.avgConfidence || 0))
  const todayManualCount = computed(() => {
    const allClassified = Number(todayStats.value.allClassified || 0)
    return Math.max(0, allClassified - todayClassifiedCount.value)
  })
  const workerOnline = computed(() => Boolean(healthStats.value.worker))
  const aiOnline = computed(() => Boolean(healthStats.value.ai))
  const isClassificationPaused = computed(() => Boolean(queueStats.value.classificationPaused))
  const classificationPauseReason = computed(() => String(queueStats.value.classificationPauseReason || ''))
  const workerStatusLabel = computed(() => {
    if (!workerOnline.value) return 'Offline'
    if (isClassificationPaused.value) return 'Paused'
    return 'Active'
  })
  const workerStatusClass = computed(() => {
    if (!workerOnline.value) return 'status-offline'
    if (isClassificationPaused.value) return 'status-warning'
    return 'status-online'
  })
  const isOperationallyActive = computed(() => (
    Boolean(primaryActiveTask.value)
    || queuePendingCount.value > 0
    || failedQueueTasks.value.length > 0
    || needsAttentionItems.value.length > 0
    || hasEnrichmentRetryPending.value
  ))

  const lastUpdatedAt = computed(() => {
    const timestamps = [
      liveStatsTimestamp.value,
      progressTimestamp.value,
      pendingTasksTimestamp.value,
      failedTasksTimestamp.value,
      pendingClassificationsTimestamp.value,
      aiGenerationStatusTimestamp.value,
      aiUsageTimestamp.value,
      librariesTimestamp.value,
      liveFeedTimestamp.value,
      mediaServerConfigTimestamp.value,
      arrConfigStatusTimestamp.value,
    ]
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0)

    if (!timestamps.length) return null
    return Math.max(...timestamps)
  })

  const lastUpdatedText = computed(() => {
    if (!lastUpdatedAt.value) return 'Waiting...'
    return new Date(lastUpdatedAt.value).toLocaleTimeString()
  })

  const statusAnnounceText = computed(() => {
    if (isAnyDataStale.value) return 'Command Center is refreshing operational data.'
    return lastUpdatedAt.value
      ? `Command Center is live. Last updated at ${lastUpdatedText.value}.`
      : 'Command Center is loading operational data.'
  })

  const hasMediaServerConfigured = computed(() => Boolean(mediaServerConfigData.value?.id))
  const incompleteArrConfigs = computed(() => Array.isArray(arrConfigStatusData.value?.incompleteConfigs) ? arrConfigStatusData.value.incompleteConfigs : [])
  const showConfigureMediaServerCta = computed(() => !hasMediaServerConfigured.value || incompleteArrConfigs.value.length > 0)
  const configureMediaServerMessage = computed(() => {
    if (!hasMediaServerConfigured.value) return 'Media Server is not configured yet. Configure it to enable full library routing.'
    if (incompleteArrConfigs.value.length > 0) return `${incompleteArrConfigs.value.length} Radarr/Sonarr mapping configuration(s) are incomplete.`
    return ''
  })

  const liveFeedByLibrary = computed(() => {
    const map = new Map()
    for (const row of liveFeedItems.value) {
      const key = `${row.library || 'unassigned'}|${row.mediaType || row.media_type || 'unknown'}`.toLowerCase()
      const current = map.get(key) || { total: 0, manual: 0 }
      current.total += 1
      if (isManualMethod(row.method)) current.manual += 1
      map.set(key, current)
    }
    return map
  })

  const activeLibrariesSummary = computed(() => activeLibraries.value.map((library) => {
    const key = `${library.name || 'unassigned'}|${library.media_type || 'unknown'}`.toLowerCase()
    const stats = liveFeedByLibrary.value.get(key) || { total: 0, manual: 0 }
    const autoPercent = stats.total > 0 ? Math.round(((stats.total - stats.manual) / stats.total) * 100) : null
    return {
      ...library,
      itemCount: Number(library.item_count || 0),
      todayCount: stats.total,
      autoPercent,
    }
  }))

  const aiGenerationTelemetryLine = computed(() => {
    if (!aiGenerationStatus.value?.isActive) return ''
    const model = aiGenerationStatus.value.model || 'unknown-model'
    const tokens = Number(aiGenerationStatus.value.tokenCount || 0)
    const elapsedSeconds = Number(aiGenerationStatus.value.elapsedSeconds || 0)
    return `${model} • ${tokens} tokens • ${elapsedSeconds.toFixed(1)}s`
  })

  const alerts = computed(() => {
    const rows = []
    if (healthStats.value.worker === false) rows.push({ id: 'worker', message: 'Worker is inactive. Queue processing has paused.', actionLabel: 'View System', action: () => router.push('/system') })
    if (classificationPauseReason.value === 'dispatch_check_failed') rows.push({ id: 'classification-dispatch-check', message: 'Classification dispatch is temporarily paused because the worker could not verify queue state.', actionLabel: 'Retry Queue View', action: () => refreshOperationalData() })
    if (healthStats.value.ai === false) rows.push({ id: 'ai', message: 'AI provider is offline. Automated classifications may be delayed.', actionLabel: 'Open AI Settings', action: () => router.push({ path: '/settings', query: { tab: 'ai' } }) })
    if (aiBudget.value.limit && aiBudget.value.percentUsed >= 90) rows.push({ id: 'budget', message: `AI budget at ${aiBudget.value.percentUsed}% (${formatUsd(aiBudget.value.used)} / ${formatUsd(aiBudget.value.limit)})`, actionLabel: 'View Usage', action: () => router.push({ path: '/settings', query: { tab: 'ai' } }) })
    return rows
  })

  async function refreshOperationalData() {
    await Promise.all([
      refreshLiveStats(),
      refreshProgressData(),
      refreshPendingTasks(),
      refreshFailedTasks(),
      refreshPendingClassifications(),
      refreshAiGenerationStatus(),
      refreshAiUsage(),
      refreshLiveFeed(),
      refreshMediaServerConfig(),
      refreshArrConfigStatus(),
    ])
  }

  function formatUsd(value) {
    const n = Number(value || 0)
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00'
  }

  function isManualMethod(method) {
    if (!method) return false
    return String(method).toLowerCase().startsWith('manual')
  }

  return {
    activeLibraries,
    activeLibrariesSummary,
    activeProcessingTasks,
    aiBudget,
    aiOnline,
    alerts,
    classificationPauseReason,
    configureMediaServerMessage,
    enrichmentEnriched,
    enrichmentOmdb,
    enrichmentOmdbPending,
    enrichmentProgress,
    enrichmentStats,
    enrichmentTavily,
    enrichmentTavilyPending,
    enrichmentTotal,
    failedQueueTasks,
    gapPercentComplete,
    gapProcessedCount,
    gapStats,
    gapTotalCount,
    hasEnrichmentRetryPending,
    hasMediaServerConfigured,
    healthStats,
    incompleteArrConfigs,
    isAnyDataStale,
    isClassificationPaused,
    isOperationallyActive,
    lastUpdatedAt,
    lastUpdatedText,
    liveFeedItems,
    liveStats,
    needsAttentionItems,
    aiGenerationStatus,
    aiGenerationTelemetryLine,
    pendingQueueTasks,
    primaryActiveTask,
    queuePendingCount,
    queueStats,
    recentlyCompletedItems,
    refreshAiUsage,
    refreshArrConfigStatus,
    refreshFailedTasks,
    refreshLibraries,
    refreshLiveFeed,
    refreshLiveStats,
    refreshMediaServerConfig,
    refreshAiGenerationStatus,
    refreshOperationalData,
    refreshPendingClassifications,
    refreshPendingTasks,
    refreshProgressData,
    showConfigureMediaServerCta,
    showEnrichmentSection,
    statusAnnounceText,
    todayAvgConfidence,
    todayClassifiedCount,
    todayManualCount,
    todayStats,
    upNextCount,
    upNextTasks,
    workerOnline,
    workerStatusClass,
    workerStatusLabel,
  }
}
