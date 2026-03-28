/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function buildPresentation(status, lastError = null) {
  switch (status) {
    case 'cooldown':
      return {
        statusLabel: 'Cooling Down',
        flag: 'WAIT',
        headline: 'Embedding provider cooling down',
        detail: lastError || 'Queued embedding work is paused until the provider passes a recovery probe.',
        tone: 'danger'
      }
    case 'probing':
      return {
        statusLabel: 'Probing',
        flag: 'TEST',
        headline: 'Embedding provider recovery probe in progress',
        detail: lastError || 'Queued embedding work is paused until the provider passes a recovery probe.',
        tone: 'warning'
      }
    case 'probe_due':
      return {
        statusLabel: 'Probe Due',
        flag: 'HOLD',
        headline: 'Embedding provider recovery probe pending',
        detail: lastError || 'Queued embedding work is paused until the provider passes a recovery probe.',
        tone: 'warning'
      }
    default:
      return {
        statusLabel: 'Available',
        flag: 'ON',
        headline: 'Embedding provider available',
        detail: lastError || 'Embedding work can run normally.',
        tone: 'success'
      }
  }
}

export function defaultEmbeddingAvailability() {
  return {
    status: 'available',
    cooldownUntil: null,
    retryAt: null,
    lastError: null,
    failureCount: 0,
    isOffline: false,
    presentation: buildPresentation('available'),
    controls: {
      canRunJobs: true,
      canStartManualBackfill: true,
      canResumeManualBackfill: true,
      queuedWorkPaused: false
    }
  }
}

export function normalizeEmbeddingAvailability(availability) {
  const base = defaultEmbeddingAvailability()
  const input = availability || {}
  const merged = {
    ...base,
    ...input
  }
  const status = merged.status || 'available'
  const presentation = {
    ...buildPresentation(status, merged.lastError),
    ...(input.presentation || {})
  }
  const controls = {
    canRunJobs: status === 'available',
    canStartManualBackfill: status === 'available',
    canResumeManualBackfill: status === 'available',
    queuedWorkPaused: status !== 'available',
    ...(input.controls || {})
  }

  return {
    ...merged,
    status,
    retryAt: merged.retryAt || merged.cooldownUntil || null,
    presentation,
    controls
  }
}

export function getEmbeddingAvailabilityToneClasses(availability) {
  const normalized = normalizeEmbeddingAvailability(availability)
  switch (normalized.presentation.tone) {
    case 'warning':
      return {
        textClass: 'text-yellow-400',
        bannerClass: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-200'
      }
    case 'danger':
      return {
        textClass: 'text-red-400',
        bannerClass: 'bg-red-500/10 border-red-500/40 text-red-200'
      }
    case 'success':
      return {
        textClass: 'text-green-400',
        bannerClass: 'bg-green-500/10 border-green-500/40 text-green-200'
      }
    default:
      return {
        textClass: 'text-gray-400',
        bannerClass: 'bg-gray-500/10 border-gray-500/40 text-gray-200'
      }
  }
}

export function buildEmbeddingProviderIndicator(availability, { providerOnline = false, providerConfigured = true } = {}) {
  const normalized = normalizeEmbeddingAvailability(availability)

  if (normalized.status !== 'available') {
    const toneClasses = getEmbeddingAvailabilityToneClasses(normalized)
    return {
      label: normalized.presentation.statusLabel,
      flag: normalized.presentation.flag,
      textClass: toneClasses.textClass
    }
  }

  if (!providerConfigured) {
    return {
      label: 'Not Configured',
      flag: 'CFG',
      textClass: 'text-gray-400'
    }
  }

  if (providerOnline) {
    return {
      label: 'Online',
      flag: 'ON',
      textClass: 'text-green-400'
    }
  }

  return {
    label: 'Offline',
    flag: 'OFF',
    textClass: 'text-red-400'
  }
}
