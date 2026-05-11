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
  const pendingBreakdown = backfillData.pendingBreakdown || { text: 0, image: 0 }

  return {
    textOnline: statusData.providerOnline === true,
    imageState: image.state,
    imageOnline: image.providerOnline,
    heartbeatActive: heartbeatData.active === true,
    queueText: pendingBreakdown.text || 0,
    queueImage: pendingBreakdown.image || 0,
    totalTextEmbeddings: statusData.stats?.total || 0,
    totalImageEmbeddings: image.totalEmbeddings,
  }
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