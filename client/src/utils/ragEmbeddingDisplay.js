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

const MODE_BADGE_CLASSES = {
  disabled: 'px-2 py-0.5 rounded-full text-xs bg-gray-600/30 text-gray-300 border border-gray-600/50',
  cloud: 'px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  same: 'px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40',
  separate_local: 'px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40',
  separate_ollama: 'px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40'
}

const STATUS_TONE_CLASSES = {
  gray: {
    dotClass: 'bg-gray-500',
    textClass: 'text-gray-400',
  },
  green: {
    dotClass: 'bg-green-500',
    textClass: 'text-green-400',
  },
  red: {
    dotClass: 'bg-red-500',
    textClass: 'text-red-400',
  },
  yellow: {
    dotClass: 'bg-yellow-500',
    textClass: 'text-yellow-400',
  },
}

function getStatusPresentation(tone, label) {
  const toneClasses = STATUS_TONE_CLASSES[tone] || STATUS_TONE_CLASSES.red

  return {
    label,
    dotClass: toneClasses.dotClass,
    textClass: toneClasses.textClass,
  }
}

export function formatEmbeddingMode(mode, { fallback = 'same' } = {}) {
  if (mode === 'separate_local' || mode === 'separate_ollama') {
    return 'separate'
  }

  return mode || fallback
}

export function getEmbeddingModeBadgeClass(mode) {
  return MODE_BADGE_CLASSES[mode] || 'px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-300 border border-gray-500/40'
}

export function getTextEmbeddingStatusPresentation(status = {}) {
  if (status.providerOnline) {
    return getStatusPresentation('green', 'Online')
  }

  if (status.providerConfigured) {
    return getStatusPresentation('yellow', 'Configured')
  }

  return getStatusPresentation('red', 'Offline')
}

export function getImageEmbeddingStatusPresentation(status = {}, {
  configuredLabel = 'Ready (Configured)',
  disabledLabel = 'Disabled',
  notConfiguredLabel = 'Not configured',
  onlineLabel = 'Online',
  offlineLabel = 'Offline',
} = {}) {
  switch (status.state) {
    case 'disabled':
      return getStatusPresentation('gray', disabledLabel)
    case 'configured':
      return getStatusPresentation('yellow', configuredLabel)
    case 'not_configured':
      return getStatusPresentation('gray', notConfiguredLabel)
    case 'online':
      return getStatusPresentation('green', onlineLabel)
    default:
      return getStatusPresentation('red', offlineLabel)
  }
}

export function formatTimeAgo(date, { now = Date.now() } = {}) {
  const then = new Date(date).getTime()

  if (!Number.isFinite(then)) {
    return 'unknown'
  }

  const diff = Math.max(0, now - then)
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function getBackfillStatusLabel(status, { disabled = false } = {}) {
  if (disabled || !status?.enabled) {
    return 'Off'
  }

  const label = status.presentation?.statusLabel || 'On'
  return status.time ? `${label} (${status.time})` : label
}

export function getLastFetchedLabel(lastFetchedAt, { emptyLabel = 'Models not fetched yet', now = Date.now() } = {}) {
  if (!lastFetchedAt) {
    return emptyLabel
  }

  return `Last fetched ${formatTimeAgo(lastFetchedAt, { now })}`
}
