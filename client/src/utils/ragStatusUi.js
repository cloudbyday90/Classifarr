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
    failedCount: imageData.stats?.failedCount ?? 0,
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

function normalizeRagPendingBreakdown(backfillData = {}) {
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
    failedCount: overviewData.stats?.failedCount ?? 0,
    avgGenerationTime: 0,
    lastEmbeddingTime: null,
    imageEnabled: image.enabled,
    imageStatus: image.state,
    imageProviderOnline: image.providerOnline,
    imageTotalEmbeddings: image.totalEmbeddings,
    imagePendingCount: image.pendingCount,
    imageFailedCount: image.failedCount,
    imageProvider: image.provider,
    imageModel: image.model,
  }
}

export function normalizeRagBackfillDiagnostics(backfillData = {}) {
  const idleDetector = backfillData.idleDetector || {}
  const latestRun = backfillData.latestRun || null
  const pendingBreakdown = normalizeRagPendingBreakdown(backfillData)
  const timeSinceActivity = Number(idleDetector.timeSinceActivity)
  const threshold = Number(idleDetector.threshold)

  return {
    pending: backfillData.pending || 0,
    pendingBreakdown,
    startupRecoveryEligible: backfillData.startupRecoveryEligible === true,
    idleDetector: {
      isIdle: idleDetector.isIdle === true
        || (Number.isFinite(timeSinceActivity) && Number.isFinite(threshold) && timeSinceActivity >= threshold),
      timeSinceActivity: Number.isFinite(timeSinceActivity) ? timeSinceActivity : null,
      threshold: Number.isFinite(threshold) ? threshold : null,
      lastActivity: idleDetector.lastActivity || null,
    },
    latestRun,
  }
}
