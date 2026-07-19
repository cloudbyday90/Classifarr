/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const DISTRIBUTION_KEYS = [
  ['genre_distribution', 'genre'],
  ['rating_distribution', 'rating'],
  ['studio_distribution', 'studio'],
  ['keyword_distribution', 'keyword'],
]

function countPositiveDistributionEntries(profile = {}, key) {
  const distribution = profile?.[key]
  if (!distribution || typeof distribution !== 'object' || Array.isArray(distribution)) {
    return 0
  }

  return Object.values(distribution).filter((value) => {
    const parsedValue = Number.parseInt(value, 10)
    return Number.isFinite(parsedValue) && parsedValue > 0
  }).length
}

function pluralize(label, count) {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

export function summarizePolicyBuilderProfileRefresh(profile = {}) {
  const counts = DISTRIBUTION_KEYS
    .map(([key, label]) => ({
      key,
      label,
      count: countPositiveDistributionEntries(profile, key),
    }))
    .filter(item => item.count > 0)

  const totalSignalCount = counts.reduce((sum, item) => sum + item.count, 0)

  return {
    totalSignalCount,
    parts: counts.map(item => pluralize(item.label, item.count)),
  }
}

export function buildPolicyBuilderProfileRefreshResult({
  outcome = 'success',
  profile = null,
  error = '',
} = {}) {
  if (outcome === 'error') {
    return {
      status: 'error',
      tone: 'warning',
      label: 'Refresh failed',
      message: error || 'Could not refresh the current library profile.',
    }
  }

  const summary = summarizePolicyBuilderProfileRefresh(profile)

  if (!summary.totalSignalCount) {
    return {
      status: 'success_empty',
      tone: 'warning',
      label: 'Profile refreshed',
      message: 'No usable genre, rating, studio, or keyword signals were found. Sync and enrich the library before relying on library-derived suggestions.',
    }
  }

  return {
    status: 'success',
    tone: 'success',
    label: 'Profile refreshed',
    message: `${summary.parts.join(', ')} available from the current library profile.`,
  }
}
