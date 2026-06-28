/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeGenreValue(value) {
  return String(value || '').trim()
}

function parseCount(value) {
  const count = Number.parseInt(value, 10)
  return Number.isFinite(count) && count > 0 ? count : 0
}

function addOption(optionMap, option) {
  const value = normalizeGenreValue(option?.value)
  if (!value) return

  const key = value.toLowerCase()
  if (!optionMap.has(key)) {
    optionMap.set(key, {
      value,
      label: option.label || value,
      source: option.source || 'preset_reference',
      sourceLabel: option.sourceLabel || '',
      count: parseCount(option.count),
      detail: option.detail || '',
    })
    return
  }

  const existing = optionMap.get(key)
  if (option.source === 'library_profile' && existing.source !== 'library_profile') {
    optionMap.set(key, {
      ...existing,
      source: 'library_profile',
      sourceLabel: option.sourceLabel || 'Already in library',
      count: parseCount(option.count),
      detail: option.detail || existing.detail,
    })
  }
}

export function buildLibraryGenreOptions(profile = null) {
  const distribution = asObject(profile?.genre_distribution)

  return Object.entries(distribution)
    .map(([genre, count]) => {
      const value = normalizeGenreValue(genre)
      const parsedCount = parseCount(count)
      if (!value || parsedCount <= 0) return null

      return {
        value,
        label: value,
        source: 'library_profile',
        sourceLabel: 'Already in library',
        count: parsedCount,
        detail: `${parsedCount} ${parsedCount === 1 ? 'item' : 'items'} in this library`,
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count
      return left.label.localeCompare(right.label)
    })
}

export function buildPresetGenreOptions(genres = []) {
  return asArray(genres)
    .map((genre) => {
      const value = normalizeGenreValue(genre)
      if (!value) return null

      return {
        value,
        label: value,
        source: 'preset_reference',
        sourceLabel: 'Starter option',
        count: 0,
        detail: 'Available from starter template signals',
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.label.localeCompare(right.label))
}

export function mergePolicyBuilderGenreOptions({
  libraryProfile = null,
  presetGenres = [],
} = {}) {
  const optionMap = new Map()

  for (const option of buildLibraryGenreOptions(libraryProfile)) {
    addOption(optionMap, option)
  }

  for (const option of buildPresetGenreOptions(presetGenres)) {
    addOption(optionMap, option)
  }

  return Array.from(optionMap.values()).sort((left, right) => {
    if (left.source === 'library_profile' && right.source !== 'library_profile') return -1
    if (right.source === 'library_profile' && left.source !== 'library_profile') return 1
    if (left.source === 'library_profile' && right.source === 'library_profile' && right.count !== left.count) {
      return right.count - left.count
    }
    return left.label.localeCompare(right.label)
  })
}

export function summarizeLibraryProfileGenres(profile = null, limit = 4) {
  return buildLibraryGenreOptions(profile)
    .slice(0, limit)
    .map(option => `${option.label} (${option.count})`)
}
