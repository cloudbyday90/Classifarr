const MODE_BADGE_CLASSES = {
  disabled: 'px-2 py-0.5 rounded-full text-xs bg-gray-600/30 text-gray-300 border border-gray-600/50',
  cloud: 'px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  same: 'px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40',
  separate_local: 'px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40',
  separate_ollama: 'px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/40'
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