import { normalizeBackfillModeStatus } from './backfillStatusUi'

export function normalizeRagImageRuntime(imageData = {}) {
  const enabled = imageData.enabled ?? false
  const providerOnline = imageData.providerOnline ?? false
  const providerConfigured = imageData.providerConfigured ?? false

  return {
    enabled,
    providerOnline,
    providerConfigured,
    state: imageData.status
      || (!enabled
        ? 'disabled'
        : providerOnline
          ? 'online'
          : providerConfigured
            ? 'configured'
            : 'not_configured'),
    provider: imageData.provider || 'unknown',
    model: imageData.model || null,
    totalEmbeddings: imageData.stats?.total ?? 0,
    pendingCount: imageData.stats?.pending ?? 0,
  }
}

export function normalizeRagHeaderStatus({ statusData = {}, backfillData = {}, heartbeatData = {} } = {}) {
  const image = normalizeRagImageRuntime(statusData.image)
  const pendingBreakdown = normalizeRagPendingBreakdown(backfillData)

  return {
    textOnline: statusData.providerOnline === true,
    imageState: image.state,
    imageOnline: image.providerOnline,
    heartbeatActive: heartbeatData.active === true,
    queueText: pendingBreakdown.text,
    queueImage: pendingBreakdown.image,
    totalTextEmbeddings: statusData.stats?.total || 0,
    totalImageEmbeddings: image.totalEmbeddings,
  }
}

export function normalizeRagPendingBreakdown(backfillData = {}) {
  const pendingBreakdown = backfillData.pendingBreakdown || { text: 0, image: 0 }

  return {
    total: backfillData.pending || 0,
    text: pendingBreakdown.text || 0,
    image: pendingBreakdown.image || 0,
  }
}

export function normalizeManualBackfillStatus(backfillData = {}) {
  const manual = backfillData.manual || {}
  const pendingBreakdown = normalizeRagPendingBreakdown(backfillData)

  return normalizeBackfillModeStatus('manual', {
    ...manual,
    status: manual.status || 'idle',
    processed: manual.processed || 0,
    total: manual.total || 0,
    pending: pendingBreakdown.total,
    pendingText: pendingBreakdown.text,
    pendingImage: pendingBreakdown.image,
    progress: manual.total > 0 ? (manual.processed / manual.total) * 100 : 0,
    eta: manual.eta || null,
  })
}

export function normalizeTextEmbeddingStatus({
  statusData = {},
  providerConfigured = false,
  providerLabel = 'unknown',
  modelLabel = 'unknown',
  mode = 'same',
} = {}) {
  return {
    providerOnline: statusData.providerOnline ?? false,
    providerConfigured,
    providerLabel,
    modelLabel,
    mode,
  }
}

export function normalizeRagOverviewStats({ overviewData = {}, embeddingAvailability } = {}) {
  const image = normalizeRagImageRuntime(overviewData.image)

  return {
    ...overviewData.stats,
    providerConfigured: overviewData.providerConfigured ?? true,
    providerOnline: overviewData.providerOnline ?? false,
    embeddingAvailability,
    totalEmbeddings: overviewData.stats?.totalEmbeddings ?? overviewData.stats?.total ?? 0,
    pendingCount: overviewData.stats?.pendingCount ?? overviewData.stats?.pendingRetries ?? 0,
    failedCount: 0,
    avgGenerationTime: 0,
    lastEmbeddingTime: null,
    imageEnabled: image.enabled,
    imageStatus: image.state,
    imageProviderOnline: image.providerOnline,
    imageTotalEmbeddings: image.totalEmbeddings,
    imagePendingCount: image.pendingCount,
    imageProvider: image.provider,
    imageModel: image.model,
  }
}
